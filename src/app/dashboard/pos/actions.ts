"use server";

import { revalidatePath } from "next/cache";
import { CommissionType, PaymentMethod, TransactionStatus } from "@/generated/prisma/client";
import { computeCommission } from "@/lib/commission";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff-auth";
import { startOfToday, endOfToday } from "@/lib/queue";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

const VAT_RATE = 7;

/// Prices shown to customers throughout booking are VAT-inclusive (one clean number, no
/// "+VAT" surprise at checkout) — so vatAmount here is a breakdown backed out of the total,
/// not an extra charge on top of it.
function computeVat(totalAmount: number): number {
  return Math.round(((totalAmount * VAT_RATE) / (100 + VAT_RATE)) * 100) / 100;
}

async function generateReceiptNo(branchId: string): Promise<string> {
  const count = await prisma.transaction.count({
    where: { branchId, createdAt: { gte: startOfToday(), lt: endOfToday() } },
  });
  const datePart = startOfToday().toISOString().slice(0, 10).replace(/-/g, "");
  return `R${datePart}-${String(count + 1).padStart(4, "0")}`;
}

export type CheckoutLineItemInput = {
  serviceOptionId: string;
  therapistId: string;
  quantity: number;
};

export type CreateTransactionInput = {
  branchId: string;
  queueId?: string;
  paymentMethod: PaymentMethod;
  discountAmount: string;
  items: CheckoutLineItemInput[];
};

export async function createTransaction(
  input: CreateTransactionInput
): Promise<ActionResult<{ transactionId: string }>> {
  const session = await requireStaffSession(input.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  if (input.items.length === 0) return { success: false, error: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ" };

  const discount = Number(input.discountAmount || "0");
  if (Number.isNaN(discount) || discount < 0) return { success: false, error: "ส่วนลดไม่ถูกต้อง" };

  if (input.queueId) {
    const existingTransaction = await prisma.transaction.findUnique({ where: { queueId: input.queueId } });
    if (existingTransaction) return { success: false, error: "คิวนี้ชำระเงินไปแล้ว" };
  }

  // Never trust a client-submitted price — look up the real, current price/promo for every line
  // server-side, and snapshot the therapist's commission at this exact moment (hard rule #4).
  const resolvedItems: {
    serviceOptionId: string;
    therapistId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    commissionType: CommissionType;
    commissionRate: number;
    commissionAmount: number;
  }[] = [];

  for (const item of input.items) {
    const option = await prisma.serviceOption.findUnique({ where: { id: item.serviceOptionId } });
    if (!option) return { success: false, error: "ไม่พบบริการที่เลือก" };

    const quantity = Math.max(1, Math.floor(item.quantity));
    const unitPrice = Number(option.promoPrice ?? option.price);
    const lineTotal = unitPrice * quantity;

    const commission = await computeCommission(item.therapistId, option.serviceId, lineTotal, quantity);

    resolvedItems.push({
      serviceOptionId: option.id,
      therapistId: item.therapistId,
      quantity,
      unitPrice,
      lineTotal,
      ...commission,
    });
  }

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  if (discount > subtotal) return { success: false, error: "ส่วนลดต้องไม่มากกว่ายอดรวม" };

  const totalAmount = subtotal - discount;
  const vatAmount = computeVat(totalAmount);
  const receiptNo = await generateReceiptNo(input.branchId);

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        branchId: input.branchId,
        queueId: input.queueId ?? null,
        receiptNo,
        cashierId: session.user.id,
        subtotal,
        discountAmount: discount,
        vatRate: VAT_RATE,
        vatAmount,
        totalAmount,
        paymentMethod: input.paymentMethod,
        status: TransactionStatus.PAID,
        paidAt: new Date(),
        items: {
          create: resolvedItems.map((i) => ({
            serviceOptionId: i.serviceOptionId,
            therapistId: i.therapistId,
            quantity: i.quantity,
            unitPriceSnapshot: i.unitPrice,
            lineTotal: i.lineTotal,
            commissionType: i.commissionType,
            commissionRate: i.commissionRate,
            commissionAmount: i.commissionAmount,
          })),
        },
      },
    });

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
          paymentMethod: input.paymentMethod,
          itemCount: resolvedItems.length,
        },
      },
    });

    return created;
  });

  revalidatePath("/dashboard/pos");
  return { success: true, data: { transactionId: transaction.id } };
}

export async function voidTransaction(transactionId: string, reason: string): Promise<ActionResult> {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction || transaction.deletedAt) return { success: false, error: "ไม่พบรายการ" };

  const session = await requireStaffSession(transaction.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (transaction.status !== TransactionStatus.PAID) {
    return { success: false, error: "ยกเลิกได้เฉพาะรายการที่ชำระแล้วเท่านั้น" };
  }
  if (!reason.trim()) return { success: false, error: "กรุณาระบุเหตุผลการยกเลิก" };

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
  });

  revalidatePath("/dashboard/pos");
  revalidatePath(`/dashboard/pos/receipt/${transactionId}`);
  return { success: true, data: undefined };
}
