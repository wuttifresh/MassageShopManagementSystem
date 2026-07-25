"use server";

import { revalidatePath } from "next/cache";
import { CommissionType, Prisma, PackageStatus, PaymentMethod, TransactionStatus } from "@/generated/prisma/client";
import { computeCommission } from "@/lib/commission";
import { awardPoints, calculatePointsEarned, reversePoints } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff-auth";
import { startOfToday, endOfToday } from "@/lib/queue";
import { resolveVoucher, redeemVoucher, releaseVoucherRedemption, VoucherError } from "@/lib/voucher";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

const VAT_RATE = 7;

/// Thrown inside the DB transaction when a package's session count runs out between our
/// pre-check and the atomic decrement (e.g. two staff redeeming the last session at once) —
/// caught below and turned into a friendly error instead of a 500.
class PackageExhaustedError extends Error {}

/// Same idea as PackageExhaustedError, for a Product's stockQuantity running out between the
/// pre-check and the atomic decrement (Phase 4).
class ProductOutOfStockError extends Error {}

/// Prices shown to customers throughout booking are VAT-inclusive (one clean number, no
/// "+VAT" surprise at checkout) — so vatAmount here is a breakdown backed out of the total,
/// not an extra charge on top of it. Tips are never part of this — see CreateTransactionInput's
/// doc comment.
function computeVat(netBeforeTip: number): number {
  return Math.round(((netBeforeTip * VAT_RATE) / (100 + VAT_RATE)) * 100) / 100;
}

async function generateReceiptNo(branchId: string): Promise<string> {
  const count = await prisma.transaction.count({
    where: { branchId, createdAt: { gte: startOfToday(), lt: endOfToday() } },
  });
  const datePart = startOfToday().toISOString().slice(0, 10).replace(/-/g, "");
  return `R${datePart}-${String(count + 1).padStart(4, "0")}`;
}

export type ServiceLineItemInput = {
  kind: "service";
  serviceOptionId: string;
  therapistId: string;
  quantity: number;
  /// Set when this line is paid for by redeeming a course credit instead of cash — the
  /// customer already paid when they bought the package, so this line charges ฿0 today.
  packageId?: string | null;
  /// Gratuity for this line's therapist (Phase 4) — paid out in full, never discounted, never
  /// subject to VAT, and doesn't count toward loyalty points (see CreateTransactionInput).
  tipAmount?: string;
};

/// A retail add-on line (Phase 4) — น้ำมันนวด, ชา, ฯลฯ. No therapist/commission/tip; stock is
/// deducted atomically at checkout (see Product.stockQuantity's doc comment).
export type ProductLineItemInput = {
  kind: "product";
  productId: string;
  quantity: number;
};

export type CheckoutLineItemInput = ServiceLineItemInput | ProductLineItemInput;

export type CreateTransactionInput = {
  branchId: string;
  queueId?: string;
  paymentMethod: PaymentMethod;
  /// Ignored when voucherCode is set — a code and a hand-typed amount are mutually exclusive,
  /// never combined, to avoid double-discounting.
  discountAmount: string;
  /// A reusable promo code (Phase 4) — resolved server-side; the discount amount it computes
  /// overrides discountAmount above. Redeemed atomically inside the checkout transaction.
  voucherCode?: string;
  items: CheckoutLineItemInput[];
};

export async function createTransaction(
  input: CreateTransactionInput
): Promise<ActionResult<{ transactionId: string }>> {
  const session = await requireStaffSession(input.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  if (input.items.length === 0) return { success: false, error: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ" };

  let customerId: string | null = null;
  if (input.queueId) {
    const queue = await prisma.queue.findUnique({ where: { id: input.queueId } });
    if (!queue) return { success: false, error: "ไม่พบคิว" };
    customerId = queue.customerId;

    const existingTransaction = await prisma.transaction.findUnique({ where: { queueId: input.queueId } });
    if (existingTransaction) return { success: false, error: "คิวนี้ชำระเงินไปแล้ว" };
  }

  // Never trust a client-submitted price — look up the real, current price/promo for every line
  // server-side, and snapshot the therapist's commission at this exact moment (hard rule #4).
  const resolvedServiceItems: {
    serviceOptionId: string;
    therapistId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    commissionType: CommissionType;
    commissionRate: number;
    commissionAmount: number;
    packageId: string | null;
    tipAmount: number;
  }[] = [];
  const resolvedProductItems: { productId: string; quantity: number; unitPrice: number; lineTotal: number }[] = [];

  for (const item of input.items) {
    if (item.kind === "product") {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || product.deletedAt || !product.isActive || product.branchId !== input.branchId) {
        return { success: false, error: "ไม่พบสินค้าที่เลือก" };
      }
      const quantity = Math.max(1, Math.floor(item.quantity));
      if (product.stockQuantity < quantity) {
        return { success: false, error: `สินค้า "${product.name}" มีไม่พอ (เหลือ ${product.stockQuantity} ชิ้น)` };
      }

      const unitPrice = Number(product.price);
      resolvedProductItems.push({ productId: product.id, quantity, unitPrice, lineTotal: unitPrice * quantity });
      continue;
    }

    const option = await prisma.serviceOption.findUnique({ where: { id: item.serviceOptionId } });
    if (!option) return { success: false, error: "ไม่พบบริการที่เลือก" };

    const quantity = Math.max(1, Math.floor(item.quantity));
    const unitPrice = Number(option.promoPrice ?? option.price);
    // The therapist still earns commission for performing the service even when it's paid for
    // via a package (the shop already collected that cash when the package was sold), so
    // commission is always computed off the nominal value — never off the ฿0 charged today.
    const nominalLineTotal = unitPrice * quantity;

    const tipAmount = Number(item.tipAmount || "0");
    if (Number.isNaN(tipAmount) || tipAmount < 0) return { success: false, error: "ยอดทิปไม่ถูกต้อง" };

    let packageId: string | null = null;
    let lineTotal = nominalLineTotal;

    if (item.packageId) {
      if (!customerId) {
        return { success: false, error: "ไม่สามารถใช้คอร์สได้เพราะไม่ทราบว่าเป็นคิวของลูกค้าคนไหน" };
      }
      const pkg = await prisma.package.findUnique({ where: { id: item.packageId } });
      if (!pkg || pkg.deletedAt) return { success: false, error: "ไม่พบคอร์สที่เลือก" };
      if (pkg.customerId !== customerId) return { success: false, error: "คอร์สนี้ไม่ใช่ของลูกค้าคนนี้" };
      if (pkg.serviceId && pkg.serviceId !== option.serviceId) {
        return { success: false, error: "คอร์สนี้ใช้กับบริการนี้ไม่ได้" };
      }
      if (pkg.remainingSessions <= 0) return { success: false, error: "คอร์สนี้ใช้ครบแล้ว" };

      packageId = pkg.id;
      lineTotal = 0;
    }

    const commission = await computeCommission(item.therapistId, option.serviceId, nominalLineTotal, quantity);

    resolvedServiceItems.push({
      serviceOptionId: option.id,
      therapistId: item.therapistId,
      quantity,
      unitPrice,
      lineTotal,
      packageId,
      tipAmount,
      ...commission,
    });
  }

  const subtotal =
    resolvedServiceItems.reduce((sum, i) => sum + i.lineTotal, 0) +
    resolvedProductItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const tipTotal = resolvedServiceItems.reduce((sum, i) => sum + i.tipAmount, 0);

  let discount: number;
  let voucherId: string | null = null;
  let voucherMaxRedemptions: number | null = null;
  if (input.voucherCode?.trim()) {
    try {
      const resolved = await resolveVoucher(input.voucherCode, subtotal);
      discount = resolved.discountAmount;
      voucherId = resolved.voucherId;
      voucherMaxRedemptions = resolved.maxRedemptions;
    } catch (error) {
      if (error instanceof VoucherError) return { success: false, error: error.message };
      throw error;
    }
  } else {
    discount = Number(input.discountAmount || "0");
    if (Number.isNaN(discount) || discount < 0) return { success: false, error: "ส่วนลดไม่ถูกต้อง" };
    if (discount > subtotal) return { success: false, error: "ส่วนลดต้องไม่มากกว่ายอดรวม" };
  }

  const netBeforeTip = subtotal - discount;
  const vatAmount = computeVat(netBeforeTip);
  const totalAmount = netBeforeTip + tipTotal;
  // Loyalty points are earned on what the shop actually took in for merchandise — not on
  // gratuity, which passes straight through to the therapist.
  const pointsEarned = calculatePointsEarned(netBeforeTip);

  // Receipt numbers are generated by counting today's transactions, which races under real
  // concurrency (two checkouts can compute the same number). The `receiptNo` unique constraint
  // is the actual guarantee; on a collision we just regenerate a fresh number and retry, rather
  // than surfacing a raw 500 to the cashier.
  const MAX_RECEIPT_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_RECEIPT_ATTEMPTS; attempt++) {
    const receiptNo = await generateReceiptNo(input.branchId);

    try {
      const transaction = await prisma.$transaction(async (tx) => {
        const created = await tx.transaction.create({
          data: {
            branchId: input.branchId,
            queueId: input.queueId ?? null,
            receiptNo,
            cashierId: session.user.id,
            voucherId,
            subtotal,
            discountAmount: discount,
            vatRate: VAT_RATE,
            vatAmount,
            tipTotal,
            totalAmount,
            paymentMethod: input.paymentMethod,
            status: TransactionStatus.PAID,
            paidAt: new Date(),
          },
        });

        for (const item of resolvedServiceItems) {
          const createdItem = await tx.transactionItem.create({
            data: {
              transactionId: created.id,
              serviceOptionId: item.serviceOptionId,
              therapistId: item.therapistId,
              quantity: item.quantity,
              unitPriceSnapshot: item.unitPrice,
              lineTotal: item.lineTotal,
              commissionType: item.commissionType,
              commissionRate: item.commissionRate,
              commissionAmount: item.commissionAmount,
              tipAmount: item.tipAmount,
            },
          });

          if (item.packageId) {
            // Atomic, race-safe cut: only decrements if a session is still actually available.
            // This is the real guarantee (hard rule #5), not the pre-check above, which is just
            // a best-effort UX optimization.
            const decremented = await tx.package.updateMany({
              where: { id: item.packageId, remainingSessions: { gt: 0 } },
              data: { remainingSessions: { decrement: 1 } },
            });
            if (decremented.count === 0) throw new PackageExhaustedError();

            const packageAfter = await tx.package.findUniqueOrThrow({ where: { id: item.packageId } });
            if (packageAfter.remainingSessions === 0) {
              await tx.package.update({
                where: { id: item.packageId },
                data: { status: PackageStatus.FULLY_USED },
              });
            }

            await tx.packageUsage.create({
              data: {
                packageId: item.packageId,
                transactionItemId: createdItem.id,
                sessionsUsed: item.quantity,
              },
            });
          }
        }

        for (const item of resolvedProductItems) {
          await tx.transactionItem.create({
            data: {
              transactionId: created.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPriceSnapshot: item.unitPrice,
              lineTotal: item.lineTotal,
            },
          });

          // Atomic, race-safe cut — same guarantee as the package decrement above, applied to
          // physical stock (hard rule #5).
          const decremented = await tx.product.updateMany({
            where: { id: item.productId, stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          if (decremented.count === 0) throw new ProductOutOfStockError();
        }

        if (voucherId) {
          await redeemVoucher(tx, voucherId, voucherMaxRedemptions);
        }

        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            actorRole: session.user.role,
            branchId: input.branchId,
            action: "CREATE",
            entityType: "Transaction",
            entityId: created.id,
            afterData: {
              receiptNo,
              totalAmount,
              tipTotal,
              voucherCode: input.voucherCode?.trim() || null,
              paymentMethod: input.paymentMethod,
              itemCount: resolvedServiceItems.length + resolvedProductItems.length,
            },
          },
        });

        if (customerId && pointsEarned > 0) {
          await awardPoints(tx, customerId, pointsEarned);
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              actorRole: session.user.role,
              branchId: input.branchId,
              action: "ADJUST_POINTS",
              entityType: "Membership",
              entityId: customerId,
              afterData: { pointsEarned, reason: "purchase", transactionId: created.id },
            },
          });
        }

        return created;
      });

      revalidatePath("/dashboard/pos");
      if (customerId) revalidatePath(`/dashboard/customers/${customerId}`);
      return { success: true, data: { transactionId: transaction.id } };
    } catch (error) {
      if (error instanceof PackageExhaustedError) {
        return { success: false, error: "ขออภัย คอร์สนี้เพิ่งถูกใช้ครบไปแล้ว กรุณาเลือกวิธีชำระเงินอื่น" };
      }
      if (error instanceof ProductOutOfStockError) {
        return { success: false, error: "ขออภัย สินค้าเพิ่งหมดสต๊อกไปพอดี กรุณาลองใหม่อีกครั้ง" };
      }
      if (error instanceof VoucherError) {
        return { success: false, error: error.message };
      }
      // Postgres unique-violation errors from Prisma don't consistently give `meta.target` as an
      // array of column names the way MySQL's do — it can be the constraint name as a plain
      // string instead — so check both shapes, plus the message text as a final fallback.
      const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : undefined;
      const targetsReceiptNo =
        (Array.isArray(target) && target.includes("receipt_no")) ||
        (typeof target === "string" && target.includes("receipt_no")) ||
        (error instanceof Error && error.message.includes("receipt_no"));
      const isReceiptCollision =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && targetsReceiptNo;
      if (isReceiptCollision && attempt < MAX_RECEIPT_ATTEMPTS) continue;
      throw error;
    }
  }

  return { success: false, error: "ไม่สามารถออกเลขที่ใบเสร็จได้ กรุณาลองใหม่อีกครั้ง" };
}

export async function voidTransaction(transactionId: string, reason: string): Promise<ActionResult> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: true, queue: true },
  });
  if (!transaction || transaction.deletedAt) return { success: false, error: "ไม่พบรายการ" };

  const session = await requireStaffSession(transaction.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (transaction.status !== TransactionStatus.PAID) {
    return { success: false, error: "ยกเลิกได้เฉพาะรายการที่ชำระแล้วเท่านั้น" };
  }
  if (!reason.trim()) return { success: false, error: "กรุณาระบุเหตุผลการยกเลิก" };

  // Points were originally earned on (subtotal - discount), never on tips — see createTransaction.
  const netBeforeTip = Number(transaction.subtotal) - Number(transaction.discountAmount);
  const pointsEarned = calculatePointsEarned(netBeforeTip);
  const customerId = transaction.queue?.customerId ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.VOIDED, voidedAt: new Date(), voidReason: reason.trim() },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: transaction.branchId,
        action: "VOID",
        entityType: "Transaction",
        entityId: transactionId,
        beforeData: { status: transaction.status },
        afterData: { status: TransactionStatus.VOIDED, voidReason: reason.trim() },
      },
    });

    // Restore any package sessions this transaction consumed — via a compensating ledger entry,
    // never by mutating or deleting the original PackageUsage row (it must stay append-only).
    for (const item of transaction.items) {
      if (item.productId) {
        // Restore stock for any product lines (Phase 4) — the mirror of the atomic decrement in
        // createTransaction; void isn't racing anything, so a plain increment is enough here.
        await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
        continue;
      }

      const usage = await tx.packageUsage.findUnique({ where: { transactionItemId: item.id } });
      if (!usage) continue;

      await tx.package.update({
        where: { id: usage.packageId },
        data: { remainingSessions: { increment: usage.sessionsUsed }, status: "ACTIVE" },
      });

      await tx.packageUsage.create({
        data: {
          packageId: usage.packageId,
          transactionItemId: null,
          sessionsUsed: -usage.sessionsUsed,
          note: `คืนครั้งจากการยกเลิกใบเสร็จ ${transaction.receiptNo}`,
        },
      });
    }

    if (transaction.voucherId) {
      await releaseVoucherRedemption(tx, transaction.voucherId);
    }

    if (customerId && pointsEarned > 0) {
      await reversePoints(tx, customerId, pointsEarned);
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          actorRole: session.user.role,
          branchId: transaction.branchId,
          action: "ADJUST_POINTS",
          entityType: "Membership",
          entityId: customerId,
          afterData: { pointsReversed: pointsEarned, reason: "void", transactionId },
        },
      });
    }
  });

  revalidatePath("/dashboard/pos");
  revalidatePath(`/dashboard/pos/receipt/${transactionId}`);
  if (customerId) revalidatePath(`/dashboard/customers/${customerId}`);
  return { success: true, data: undefined };
}
