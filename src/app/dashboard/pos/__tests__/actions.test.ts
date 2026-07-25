import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  queueFindUnique,
  transactionFindUnique,
  transactionCount,
  serviceOptionFindUnique,
  productFindUnique,
  packageFindUnique,
  transactionMock,
  requireStaffSession,
  computeCommission,
  awardPoints,
  calculatePointsEarned,
  reversePoints,
  resolveVoucher,
  redeemVoucher,
  releaseVoucherRedemption,
} = vi.hoisted(() => ({
  queueFindUnique: vi.fn(),
  transactionFindUnique: vi.fn(),
  transactionCount: vi.fn(),
  serviceOptionFindUnique: vi.fn(),
  productFindUnique: vi.fn(),
  packageFindUnique: vi.fn(),
  transactionMock: vi.fn(),
  requireStaffSession: vi.fn(),
  computeCommission: vi.fn(),
  awardPoints: vi.fn(),
  calculatePointsEarned: vi.fn(),
  reversePoints: vi.fn(),
  resolveVoucher: vi.fn(),
  redeemVoucher: vi.fn(),
  releaseVoucherRedemption: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    queue: { findUnique: queueFindUnique },
    transaction: { findUnique: transactionFindUnique, count: transactionCount },
    serviceOption: { findUnique: serviceOptionFindUnique },
    product: { findUnique: productFindUnique },
    package: { findUnique: packageFindUnique },
    $transaction: transactionMock,
  },
}));
vi.mock("@/lib/staff-auth", () => ({ requireStaffSession }));
vi.mock("@/lib/commission", () => ({ computeCommission }));
vi.mock("@/lib/loyalty", () => ({ awardPoints, calculatePointsEarned, reversePoints }));
vi.mock("@/lib/voucher", async () => {
  const actual = await vi.importActual<typeof import("@/lib/voucher")>("@/lib/voucher");
  return { ...actual, resolveVoucher, redeemVoucher, releaseVoucherRedemption };
});
vi.mock("@/lib/queue", () => ({
  startOfToday: () => new Date("2026-01-01T00:00:00Z"),
  endOfToday: () => new Date("2026-01-02T00:00:00Z"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createTransaction, voidTransaction } from "../actions";
import { VoucherError } from "@/lib/voucher";

const SESSION = { user: { id: "staff-1", role: "STAFF" } };

beforeEach(() => {
  queueFindUnique.mockReset();
  transactionFindUnique.mockReset();
  transactionCount.mockReset().mockResolvedValue(0);
  serviceOptionFindUnique.mockReset();
  productFindUnique.mockReset();
  packageFindUnique.mockReset();
  transactionMock.mockReset();
  requireStaffSession.mockReset().mockResolvedValue(SESSION);
  computeCommission.mockReset().mockResolvedValue({ commissionType: "PERCENTAGE", commissionRate: 40, commissionAmount: 40 });
  awardPoints.mockReset();
  calculatePointsEarned.mockReset().mockReturnValue(0);
  reversePoints.mockReset();
  resolveVoucher.mockReset();
  redeemVoucher.mockReset();
  releaseVoucherRedemption.mockReset();
});

function makeTx() {
  return {
    transaction: { create: vi.fn().mockResolvedValue({ id: "txn-1" }), update: vi.fn() },
    transactionItem: { create: vi.fn().mockResolvedValue({ id: "item-1" }) },
    product: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn() },
    package: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    packageUsage: { create: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  };
}

describe("createTransaction — product line items", () => {
  it("decrements stock atomically and succeeds when enough stock is available", async () => {
    productFindUnique.mockResolvedValue({
      id: "prod-1",
      branchId: "branch-1",
      name: "น้ำมันนวด",
      price: "100",
      stockQuantity: 5,
      isActive: true,
      deletedAt: null,
    });
    const tx = makeTx();
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const result = await createTransaction({
      branchId: "branch-1",
      paymentMethod: "CASH",
      discountAmount: "0",
      items: [{ kind: "product", productId: "prod-1", quantity: 2 }],
    });

    expect(result.success).toBe(true);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "prod-1", stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } },
    });
  });

  it("rejects when the pre-check sees insufficient stock", async () => {
    productFindUnique.mockResolvedValue({
      id: "prod-1",
      branchId: "branch-1",
      name: "น้ำมันนวด",
      price: "100",
      stockQuantity: 1,
      isActive: true,
      deletedAt: null,
    });

    const result = await createTransaction({
      branchId: "branch-1",
      paymentMethod: "CASH",
      discountAmount: "0",
      items: [{ kind: "product", productId: "prod-1", quantity: 2 }],
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("fails gracefully when stock runs out between the pre-check and the atomic decrement", async () => {
    productFindUnique.mockResolvedValue({
      id: "prod-1",
      branchId: "branch-1",
      name: "น้ำมันนวด",
      price: "100",
      stockQuantity: 5,
      isActive: true,
      deletedAt: null,
    });
    const tx = makeTx();
    tx.product.updateMany = vi.fn().mockResolvedValue({ count: 0 }); // someone else took the last units
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const result = await createTransaction({
      branchId: "branch-1",
      paymentMethod: "CASH",
      discountAmount: "0",
      items: [{ kind: "product", productId: "prod-1", quantity: 2 }],
    });

    expect(result).toEqual({ success: false, error: expect.stringContaining("หมดสต๊อก") });
  });
});

describe("createTransaction — voucher codes", () => {
  it("resolves and redeems a voucher, using its discount instead of the manual amount", async () => {
    serviceOptionFindUnique.mockResolvedValue({ id: "so-1", serviceId: "svc-1", price: "500", promoPrice: null });
    resolveVoucher.mockResolvedValue({ voucherId: "v1", maxRedemptions: 5, discountAmount: 50 });
    const tx = makeTx();
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const result = await createTransaction({
      branchId: "branch-1",
      paymentMethod: "CASH",
      discountAmount: "999", // should be ignored in favor of the voucher
      voucherCode: "SUMMER10",
      items: [{ kind: "service", serviceOptionId: "so-1", therapistId: "th-1", quantity: 1 }],
    });

    expect(result.success).toBe(true);
    expect(resolveVoucher).toHaveBeenCalledWith("SUMMER10", 500);
    expect(redeemVoucher).toHaveBeenCalledWith(tx, "v1", 5);
    const createCall = tx.transaction.create.mock.calls[0][0];
    expect(createCall.data.discountAmount).toBe(50);
    expect(createCall.data.voucherId).toBe("v1");
  });

  it("returns the voucher's error message when the code is invalid", async () => {
    serviceOptionFindUnique.mockResolvedValue({ id: "so-1", serviceId: "svc-1", price: "500", promoPrice: null });
    resolveVoucher.mockRejectedValue(new VoucherError("ไม่พบโค้ดส่วนลดนี้"));

    const result = await createTransaction({
      branchId: "branch-1",
      paymentMethod: "CASH",
      discountAmount: "0",
      voucherCode: "BADCODE",
      items: [{ kind: "service", serviceOptionId: "so-1", therapistId: "th-1", quantity: 1 }],
    });

    expect(result).toEqual({ success: false, error: "ไม่พบโค้ดส่วนลดนี้" });
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe("createTransaction — tips", () => {
  it("adds tips on top of the VAT-inclusive total without taxing them", async () => {
    serviceOptionFindUnique.mockResolvedValue({ id: "so-1", serviceId: "svc-1", price: "107", promoPrice: null });
    const tx = makeTx();
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const result = await createTransaction({
      branchId: "branch-1",
      paymentMethod: "CASH",
      discountAmount: "0",
      items: [{ kind: "service", serviceOptionId: "so-1", therapistId: "th-1", quantity: 1, tipAmount: "20" }],
    });

    expect(result.success).toBe(true);
    const createCall = tx.transaction.create.mock.calls[0][0];
    expect(createCall.data.tipTotal).toBe(20);
    // netBeforeTip (107) + tip (20) = 127, not (107+20) taxed together.
    expect(createCall.data.totalAmount).toBe(127);
    expect(createCall.data.vatAmount).toBe(7); // VAT backed out of 107 only
  });
});

describe("voidTransaction", () => {
  it("restores product stock and releases the voucher redemption", async () => {
    transactionFindUnique.mockResolvedValue({
      id: "txn-1",
      branchId: "branch-1",
      status: "PAID",
      subtotal: 200,
      discountAmount: 0,
      totalAmount: 200,
      receiptNo: "R001",
      voucherId: "v1",
      items: [{ id: "item-1", productId: "prod-1", quantity: 3, therapistId: null }],
      queue: null,
    });
    const tx = {
      transaction: { update: vi.fn() },
      auditLog: { create: vi.fn() },
      product: { update: vi.fn() },
      packageUsage: { findUnique: vi.fn() },
    };
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const result = await voidTransaction("txn-1", "ลูกค้าขอคืน");

    expect(result.success).toBe(true);
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "prod-1" }, data: { stockQuantity: { increment: 3 } } });
    expect(releaseVoucherRedemption).toHaveBeenCalledWith(tx, "v1");
  });
});
