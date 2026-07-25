"use server";

import { revalidatePath } from "next/cache";
import { DiscountType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/// Promo codes affect revenue/margin shop-wide, so managing them is OWNER-only — same reasoning
/// as branches/staff (src/app/dashboard/branches/actions.ts), not the "OWNER and STAFF are equal"
/// treatment day-to-day catalog edits (services/therapists) get.
async function requireOwnerSession() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== "OWNER") return null;
  return session;
}

export type VoucherInput = {
  code: string;
  discountType: DiscountType;
  discountValue: string;
  /// "" = unlimited redemptions.
  maxRedemptions: string;
  /// "" = never expires.
  expiresAt: string;
};

function validateVoucherInput(input: VoucherInput): string | null {
  if (!input.code.trim()) return "กรุณาระบุรหัสส่วนลด";
  const discountValue = Number(input.discountValue);
  if (Number.isNaN(discountValue) || discountValue <= 0) return "มูลค่าส่วนลดต้องมากกว่า 0";
  if (input.discountType === DiscountType.PERCENTAGE && discountValue > 100) {
    return "ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100%";
  }
  if (input.maxRedemptions.trim() !== "") {
    const max = Number(input.maxRedemptions);
    if (!Number.isInteger(max) || max <= 0) return "จำนวนครั้งที่ใช้ได้ต้องเป็นจำนวนเต็มมากกว่า 0";
  }
  return null;
}

export async function createVoucher(input: VoucherInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireOwnerSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const validationError = validateVoucherInput(input);
  if (validationError) return { success: false, error: validationError };

  const code = input.code.trim().toUpperCase();
  const existing = await prisma.voucher.findUnique({ where: { code } });
  if (existing) return { success: false, error: "มีรหัสส่วนลดนี้อยู่แล้ว" };

  const voucher = await prisma.$transaction(async (tx) => {
    const created = await tx.voucher.create({
      data: {
        code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxRedemptions: input.maxRedemptions.trim() === "" ? null : Number(input.maxRedemptions),
        expiresAt: input.expiresAt.trim() === "" ? null : new Date(input.expiresAt),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "CREATE",
        entityType: "Voucher",
        entityId: created.id,
        afterData: { code, discountType: input.discountType, discountValue: input.discountValue },
      },
    });

    return created;
  });

  revalidatePath("/dashboard/vouchers");
  return { success: true, data: { id: voucher.id } };
}

export type VoucherUpdateInput = {
  discountType: DiscountType;
  discountValue: string;
  maxRedemptions: string;
  expiresAt: string;
  isActive: boolean;
};

export async function updateVoucher(id: string, input: VoucherUpdateInput): Promise<ActionResult> {
  const session = await requireOwnerSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "ไม่พบรหัสส่วนลด" };

  const validationError = validateVoucherInput({ code: existing.code, ...input });
  if (validationError) return { success: false, error: validationError };

  await prisma.$transaction(async (tx) => {
    await tx.voucher.update({
      where: { id },
      data: {
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxRedemptions: input.maxRedemptions.trim() === "" ? null : Number(input.maxRedemptions),
        expiresAt: input.expiresAt.trim() === "" ? null : new Date(input.expiresAt),
        isActive: input.isActive,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "UPDATE",
        entityType: "Voucher",
        entityId: id,
        beforeData: {
          discountType: existing.discountType,
          discountValue: existing.discountValue.toString(),
          isActive: existing.isActive,
        },
        afterData: { discountType: input.discountType, discountValue: input.discountValue, isActive: input.isActive },
      },
    });
  });

  revalidatePath("/dashboard/vouchers");
  revalidatePath(`/dashboard/vouchers/${id}`);
  return { success: true, data: undefined };
}
