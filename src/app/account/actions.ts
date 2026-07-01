"use server";

import { revalidatePath } from "next/cache";
import { isDriverAdapterError } from "@prisma/driver-adapter-utils";
import { BookingSource, BookingStatus, Role } from "@/generated/prisma/client";
import { findAvailableTherapist } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

const POSTGRES_EXCLUSION_VIOLATION = "23P01";
const CANCELLABLE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

async function loadOwnBooking(bookingId: string) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== Role.CUSTOMER) {
    return { session: null, booking: null } as const;
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== session.user.id || booking.deletedAt) {
    return { session, booking: null } as const;
  }

  return { session, booking } as const;
}

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  const { session, booking } = await loadOwnBooking(bookingId);
  if (!session?.user) return { success: false, error: "กรุณาเข้าสู่ระบบก่อน" };
  if (!booking) return { success: false, error: "ไม่พบการจองนี้" };
  if (!CANCELLABLE_STATUSES.includes(booking.status)) {
    return { success: false, error: "ไม่สามารถยกเลิกการจองนี้ได้" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancelReason: "ลูกค้ายกเลิกเอง" },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: booking.branchId,
        action: "CANCEL_BOOKING",
        entityType: "Booking",
        entityId: bookingId,
        beforeData: { status: booking.status },
        afterData: { status: BookingStatus.CANCELLED },
      },
    });
  });

  revalidatePath("/account");
  return { success: true, data: undefined };
}

export async function rescheduleBooking(
  bookingId: string,
  date: string,
  time: string
): Promise<ActionResult<{ newBookingId: string }>> {
  const { session, booking } = await loadOwnBooking(bookingId);
  if (!session?.user) return { success: false, error: "กรุณาเข้าสู่ระบบก่อน" };
  if (!booking) return { success: false, error: "ไม่พบการจองนี้" };
  if (!CANCELLABLE_STATUSES.includes(booking.status)) {
    return { success: false, error: "ไม่สามารถเลื่อนนัดการจองนี้ได้" };
  }

  const serviceOption = await prisma.serviceOption.findUniqueOrThrow({
    where: { id: booking.serviceOptionId },
  });

  const [hours, minutes] = time.split(":").map(Number);
  const newStart = new Date(date);
  newStart.setUTCHours(hours, minutes, 0, 0);
  const newEnd = new Date(newStart.getTime() + serviceOption.durationMinutes * 60_000);

  const oneHourFromNow = new Date(Date.now() + 60 * 60_000);
  if (newStart < oneHourFromNow) {
    return { success: false, error: "กรุณาเลือกเวลาล่วงหน้าอย่างน้อย 1 ชั่วโมง" };
  }

  // Keep the same therapist as the original booking (customer already chose them) — if they're
  // not free at the new time, ask the customer to try another time rather than silently swapping
  // to a different person.
  const resolvedTherapistId = await findAvailableTherapist(
    booking.branchId,
    serviceOption.serviceId,
    newStart,
    newEnd,
    booking.therapistId
  );

  if (!resolvedTherapistId) {
    return { success: false, error: "หมอนวดคนเดิมไม่ว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น" };
  }

  try {
    const newBooking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          branchId: booking.branchId,
          customerId: booking.customerId,
          serviceOptionId: booking.serviceOptionId,
          therapistId: resolvedTherapistId,
          startTime: newStart,
          endTime: newEnd,
          status: BookingStatus.CONFIRMED,
          source: BookingSource.ONLINE,
          createdById: session.user.id,
          rescheduledFromId: booking.id,
        },
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.RESCHEDULED },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          actorRole: session.user.role,
          branchId: booking.branchId,
          action: "RESCHEDULE_BOOKING",
          entityType: "Booking",
          entityId: booking.id,
          beforeData: { status: booking.status, startTime: booking.startTime.toISOString() },
          afterData: { newBookingId: created.id, startTime: created.startTime.toISOString() },
        },
      });

      return created;
    });

    revalidatePath("/account");
    return { success: true, data: { newBookingId: newBooking.id } };
  } catch (error) {
    if (
      isDriverAdapterError(error) &&
      error.cause.kind === "postgres" &&
      error.cause.code === POSTGRES_EXCLUSION_VIOLATION
    ) {
      return { success: false, error: "ขออภัย ช่วงเวลานี้เพิ่งถูกจองไปแล้ว กรุณาเลือกเวลาอื่น" };
    }
    throw error;
  }
}
