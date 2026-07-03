"use server";

import { revalidatePath } from "next/cache";
import { BookingSource, Role } from "@/generated/prisma/client";
import { sendLineMessage } from "@/lib/line-messaging";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { BookingValidationError, SlotTakenError, createBooking as createBookingShared } from "@/lib/booking-service";

function formatThaiDateTime(date: Date): string {
  return date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export type CreateBookingInput = {
  branchId: string;
  serviceOptionId: string;
  /// null = customer picked "คนไหนก็ได้" (any available therapist)
  therapistId: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
};

export type CreateBookingResult = { success: true; bookingId: string } | { success: false; error: string };

/// Thin wrapper around the shared, channel-agnostic booking service (src/lib/booking-service.ts):
/// this function's only remaining job is the web-specific concerns — checking the NextAuth
/// session, and sending the existing LINE push notification — while the actual validation,
/// overlap handling, and DB write live in one place shared with the LINE/WhatsApp entry points.
/// The public contract (inputs/outputs) is unchanged, so booking-wizard.tsx needed no changes.
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== Role.CUSTOMER) {
    return { success: false, error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้าก่อนทำการจอง" };
  }

  try {
    const booking = await createBookingShared({
      branchId: input.branchId,
      serviceOptionId: input.serviceOptionId,
      therapistId: input.therapistId,
      date: input.date,
      time: input.time,
      source: BookingSource.ONLINE,
      customer: { type: "user", userId: session.user.id },
    });

    const [customer, serviceOption, branch] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { lineUserId: true } }),
      prisma.serviceOption.findUnique({ where: { id: input.serviceOptionId }, include: { service: true } }),
      prisma.branch.findUnique({ where: { id: input.branchId } }),
    ]);
    if (customer?.lineUserId && serviceOption && branch) {
      await sendLineMessage(
        customer.lineUserId,
        `ยืนยันการจองสำเร็จ ✅\nบริการ: ${serviceOption.service.name} (${serviceOption.durationMinutes} นาที)\nสาขา: ${branch.name}\nวันเวลา: ${formatThaiDateTime(booking.startTime)}`
      );
    }

    revalidatePath("/account");
    return { success: true, bookingId: booking.id };
  } catch (error) {
    if (error instanceof BookingValidationError || error instanceof SlotTakenError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
