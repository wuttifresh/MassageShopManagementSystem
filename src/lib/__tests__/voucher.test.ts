import { describe, expect, it, vi, beforeEach } from "vitest";

const { voucherFindUnique, voucherUpdateMany, voucherUpdate } = vi.hoisted(() => ({
  voucherFindUnique: vi.fn(),
  voucherUpdateMany: vi.fn(),
  voucherUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { voucher: { findUnique: voucherFindUnique } },
}));

import { computeVoucherDiscount, resolveVoucher, redeemVoucher, releaseVoucherRedemption, VoucherError } from "@/lib/voucher";
import { DiscountType } from "@/generated/prisma/client";

beforeEach(() => {
  voucherFindUnique.mockReset();
  voucherUpdateMany.mockReset();
  voucherUpdate.mockReset();
});

describe("computeVoucherDiscount", () => {
  it("computes a percentage discount", () => {
    expect(computeVoucherDiscount(DiscountType.PERCENTAGE, 10, 500)).toBe(50);
  });

  it("computes a fixed-amount discount", () => {
    expect(computeVoucherDiscount(DiscountType.FIXED_AMOUNT, 100, 500)).toBe(100);
  });

  it("never discounts more than the subtotal", () => {
    expect(computeVoucherDiscount(DiscountType.FIXED_AMOUNT, 1000, 500)).toBe(500);
  });

  it("never goes negative", () => {
    expect(computeVoucherDiscount(DiscountType.FIXED_AMOUNT, -50, 500)).toBe(0);
  });
});

describe("resolveVoucher", () => {
  it("throws when the code doesn't exist", async () => {
    voucherFindUnique.mockResolvedValue(null);
    await expect(resolveVoucher("NOPE", 500)).rejects.toBeInstanceOf(VoucherError);
  });

  it("throws when the voucher is inactive", async () => {
    voucherFindUnique.mockResolvedValue({ isActive: false, expiresAt: null, maxRedemptions: null, redemptionCount: 0 });
    await expect(resolveVoucher("CODE", 500)).rejects.toBeInstanceOf(VoucherError);
  });

  it("throws when the voucher has expired", async () => {
    voucherFindUnique.mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() - 1000),
      maxRedemptions: null,
      redemptionCount: 0,
    });
    await expect(resolveVoucher("CODE", 500)).rejects.toBeInstanceOf(VoucherError);
  });

  it("throws when redemptions are exhausted", async () => {
    voucherFindUnique.mockResolvedValue({
      id: "v1",
      isActive: true,
      expiresAt: null,
      maxRedemptions: 2,
      redemptionCount: 2,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
    });
    await expect(resolveVoucher("CODE", 500)).rejects.toBeInstanceOf(VoucherError);
  });

  it("resolves a valid voucher with its computed discount", async () => {
    voucherFindUnique.mockResolvedValue({
      id: "v1",
      isActive: true,
      expiresAt: null,
      maxRedemptions: 5,
      redemptionCount: 1,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
    });
    const result = await resolveVoucher("CODE", 500);
    expect(result).toEqual({ voucherId: "v1", maxRedemptions: 5, discountAmount: 50 });
  });
});

describe("redeemVoucher", () => {
  it("increments redemptionCount when the update matches a row", async () => {
    voucherUpdateMany.mockResolvedValue({ count: 1 });
    const tx = { voucher: { updateMany: voucherUpdateMany } } as never;
    await expect(redeemVoucher(tx, "v1", 5)).resolves.toBeUndefined();
    expect(voucherUpdateMany).toHaveBeenCalledWith({
      where: { id: "v1", isActive: true, redemptionCount: { lt: 5 } },
      data: { redemptionCount: { increment: 1 } },
    });
  });

  it("omits the redemptionCount guard when unlimited", async () => {
    voucherUpdateMany.mockResolvedValue({ count: 1 });
    const tx = { voucher: { updateMany: voucherUpdateMany } } as never;
    await redeemVoucher(tx, "v1", null);
    expect(voucherUpdateMany).toHaveBeenCalledWith({
      where: { id: "v1", isActive: true },
      data: { redemptionCount: { increment: 1 } },
    });
  });

  it("throws when no row matched (limit reached concurrently)", async () => {
    voucherUpdateMany.mockResolvedValue({ count: 0 });
    const tx = { voucher: { updateMany: voucherUpdateMany } } as never;
    await expect(redeemVoucher(tx, "v1", 5)).rejects.toBeInstanceOf(VoucherError);
  });
});

describe("releaseVoucherRedemption", () => {
  it("decrements redemptionCount", async () => {
    voucherUpdate.mockResolvedValue({});
    const tx = { voucher: { update: voucherUpdate } } as never;
    await releaseVoucherRedemption(tx, "v1");
    expect(voucherUpdate).toHaveBeenCalledWith({ where: { id: "v1" }, data: { redemptionCount: { decrement: 1 } } });
  });
});
