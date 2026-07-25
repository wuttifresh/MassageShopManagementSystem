import type { Prisma } from "@/generated/prisma/client";
import { DiscountType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/// Voucher/promo-code handling for POS (Phase 4). A voucher is a reusable code (e.g. "SUMMER10"),
/// redeemable by any customer up to `maxRedemptions` times (null = unlimited) and/or until
/// `expiresAt` — not a per-customer coupon.

export class VoucherError extends Error {}

export function computeVoucherDiscount(discountType: DiscountType, discountValue: number, subtotal: number): number {
  const raw = discountType === DiscountType.PERCENTAGE ? (subtotal * discountValue) / 100 : discountValue;
  // Never discount more than the sale is worth, and never go below zero on a stray negative input.
  return Math.max(0, Math.min(Math.round(raw * 100) / 100, subtotal));
}

export type ResolvedVoucher = {
  voucherId: string;
  maxRedemptions: number | null;
  discountAmount: number;
};

/// Looks up a code and computes what discount it would apply against `subtotal` — read-only, does
/// NOT redeem/increment anything (see redeemVoucher for the atomic redemption inside checkout).
/// Used both for a staff-facing "preview" and as the first half of the actual checkout.
export async function resolveVoucher(code: string, subtotal: number): Promise<ResolvedVoucher> {
  const trimmed = code.trim();
  if (!trimmed) throw new VoucherError("กรุณาระบุโค้ดส่วนลด");

  const voucher = await prisma.voucher.findUnique({ where: { code: trimmed } });
  if (!voucher || !voucher.isActive) throw new VoucherError("ไม่พบโค้ดส่วนลดนี้ หรือถูกปิดใช้งานแล้ว");
  if (voucher.expiresAt && voucher.expiresAt < new Date()) throw new VoucherError("โค้ดส่วนลดนี้หมดอายุแล้ว");
  if (voucher.maxRedemptions !== null && voucher.redemptionCount >= voucher.maxRedemptions) {
    throw new VoucherError("โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว");
  }

  return {
    voucherId: voucher.id,
    maxRedemptions: voucher.maxRedemptions,
    discountAmount: computeVoucherDiscount(voucher.discountType, Number(voucher.discountValue), subtotal),
  };
}

/// Atomically increments a voucher's redemption count, guarded by the same limit check that
/// resolveVoucher applied — the actual guarantee against two concurrent checkouts both squeezing
/// through the last redemption (hard rule #5's atomic-decrement pattern, applied here to an
/// increment-with-a-ceiling instead). Must run inside the same $transaction as the checkout.
export async function redeemVoucher(
  tx: Prisma.TransactionClient,
  voucherId: string,
  maxRedemptions: number | null
): Promise<void> {
  const result = await tx.voucher.updateMany({
    where: {
      id: voucherId,
      isActive: true,
      ...(maxRedemptions === null ? {} : { redemptionCount: { lt: maxRedemptions } }),
    },
    data: { redemptionCount: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new VoucherError("โค้ดส่วนลดนี้เพิ่งถูกใช้ครบจำนวนไปแล้ว กรุณาลองใหม่โดยไม่ใช้โค้ด");
  }
}

/// Reverses a redemption when its transaction is voided — a compensating decrement, matching how
/// Package sessions and loyalty points are restored on void elsewhere in this codebase.
export async function releaseVoucherRedemption(tx: Prisma.TransactionClient, voucherId: string): Promise<void> {
  await tx.voucher.update({
    where: { id: voucherId },
    data: { redemptionCount: { decrement: 1 } },
  });
}
