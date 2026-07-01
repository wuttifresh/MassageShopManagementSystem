"use server";

import { revalidatePath } from "next/cache";
import { isDriverAdapterError } from "@prisma/driver-adapter-utils";
import { BookingSource, BookingStatus, Role } from "@/generated/prisma/client";
import { findAvailableTherapist } from "@/lib/availability";
import { sendLineMessage } from "@/lib/line-messaging";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

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

const POSTGRES_EXCLUSION_VIOLATION = "23P01";

function combine(date: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setUTCHours(hours, minutes, 0, 0);
  return combined;
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== Role.CUSTOMER) {
    return { success: false, error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้าก่อนทำการจอง" };
  }

  const serviceOption = await prisma.serviceOption.findUnique({
    where: { id: input.serviceOptionId, isActive: true },
    include: { service: true },
  });
  if (!serviceOption) {
    return { success: false, error: "ไม่พบบริการที่เลือก" };
  }

  const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
  if (!branch) {
    return { success: false, error: "ไม่พบสาขาที่เลือก" };
  }

  const startTime = combine(input.date, input.time);
  const endTime = new Date(startTime.getTime() + serviceOption.durationMinutes * 60_000);

  const oneHourFromNow = new Date(Date.now() + 60 * 60_000);
  if (startTime < oneHourFromNow) {
    return { success: false, error: "กรุณาจองล่วงหน้าอย่างน้อย 1 ชั่วโมง" };
  }

  const resolvedTherapistId = await findAvailableTherapist(
    input.branchId,
    serviceOption.serviceId,
    startTime,
    endTime,
    input.therapistId
  );

  if (!resolvedTherapistId) {
    return {
      success: false,
      error: "ขออภัย ไม่มีหมอนวดว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น",
    };
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          branchId: input.branchId,
          customerId: session.user.id,
          serviceOptionId: input.serviceOptionId,
          therapistId: resolvedTherapistId,
          startTime,
          endTime,
          status: BookingStatus.CONFIRMED,
          source: BookingSource.ONLINE,
          createdById: session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          actorRole: session.user.role,
          branchId: input.branchId,
          action: "CREATE",
          entityType: "Booking",
          entityId: created.id,
          afterData: {
            serviceOptionId: created.serviceOptionId,
            therapistId: created.therapistId,
            startTime: created.startTime.toISOString(),
            endTime: created.endTime.toISOString(),
            status: created.status,
          },
        },
      });

      return created;
    });

    const customer = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lineUserId: true },
    });
    if (customer?.lineUserId) {
      await sendLineMessage(
        customer.lineUserId,
        `ยืนยันการจองสำเร็จ ✅\nบริการ: ${serviceOption.service.name} (${serviceOption.durationMinutes} นาที)\nสาขา: ${branch.name}\nวันเวลา: ${formatThaiDateTime(startTime)}`
      );
    }

    revalidatePath("/account");
    return { success: true, bookingId: booking.id };
  } catch (error) {
    // The DB-level EXCLUDE constraint (hard rule #6) is the real guarantee against
    // double-booking; the availability check above is only a best-effort UX optimization.
    // If two customers race for the same slot, one of these transactions loses here.
    if (
      isDriverAdapterError(error) &&
      error.cause.kind === "postgres" &&
      error.cause.code === POSTGRES_EXCLUSION_VIOLATION
    ) {
      return {
        success: false,
        error: "ขออภัย ช่วงเวลานี้เพิ่งถูกจองไปแล้ว กรุณาเลือกเวลาอื่น",
      };
    }
    throw error;
  }
}
