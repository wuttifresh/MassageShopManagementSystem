"use server";

import { revalidatePath } from "next/cache";
import { BookingStatus, QueueStatus } from "@/generated/prisma/client";
import { generateQueueNumber, isTherapistBusy } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff-auth";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export async function checkInBooking(
  bookingId: string,
  therapistId?: string | null
): Promise<ActionResult<{ queueId: string }>> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { queue: true } });
  if (!booking) return { success: false, error: "ไม่พบการจอง" };

  const session = await requireStaffSession(booking.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (booking.queue) return { success: false, error: "เช็คอินไปแล้ว" };
  if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
    return { success: false, error: "ไม่สามารถเช็คอินการจองนี้ได้" };
  }

  // Staff can pick (or override) the therapist right at check-in; otherwise fall back to
  // whoever the customer originally booked with, if anyone.
  const finalTherapistId = therapistId || booking.therapistId;
  if (finalTherapistId) {
    const therapist = await prisma.therapist.findUnique({ where: { id: finalTherapistId } });
    if (!therapist || therapist.deletedAt || therapist.branchId !== booking.branchId) {
      return { success: false, error: "ไม่พบหมอนวดที่เลือก" };
    }
    if (await isTherapistBusy(finalTherapistId)) {
      return { success: false, error: "หมอนวดคนนี้กำลังนวดลูกค้าคนอื่นอยู่" };
    }
  }

  const queueNumber = await generateQueueNumber(booking.branchId);

  const queue = await prisma.$transaction(async (tx) => {
    const created = await tx.queue.create({
      data: {
        branchId: booking.branchId,
        bookingId: booking.id,
        customerId: booking.customerId,
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        serviceOptionId: booking.serviceOptionId,
        therapistId: finalTherapistId,
        queueNumber,
        status: finalTherapistId ? QueueStatus.ASSIGNED : QueueStatus.WAITING,
        checkedInAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: booking.branchId,
        action: "CHECK_IN",
        entityType: "Queue",
        entityId: created.id,
        afterData: { bookingId: booking.id, status: created.status, therapistId: finalTherapistId },
      },
    });

    return created;
  });

  revalidatePath("/dashboard");
  return { success: true, data: { queueId: queue.id } };
}

export type AddWalkInInput = {
  branchId: string;
  serviceOptionId: string;
  therapistId: string | null;
  guestName: string;
  guestPhone?: string;
};

export async function addWalkInQueue(input: AddWalkInInput): Promise<ActionResult<{ queueId: string }>> {
  const session = await requireStaffSession(input.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (!input.guestName.trim()) return { success: false, error: "กรุณาระบุชื่อลูกค้า" };
  if (input.therapistId && (await isTherapistBusy(input.therapistId))) {
    return { success: false, error: "หมอนวดคนนี้กำลังนวดลูกค้าคนอื่นอยู่" };
  }

  const queueNumber = await generateQueueNumber(input.branchId);

  const queue = await prisma.$transaction(async (tx) => {
    const created = await tx.queue.create({
      data: {
        branchId: input.branchId,
        serviceOptionId: input.serviceOptionId,
        therapistId: input.therapistId,
        guestName: input.guestName.trim(),
        guestPhone: input.guestPhone?.trim() || null,
        queueNumber,
        status: input.therapistId ? QueueStatus.ASSIGNED : QueueStatus.WAITING,
        checkedInAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: input.branchId,
        action: "CHECK_IN",
        entityType: "Queue",
        entityId: created.id,
        afterData: { walkIn: true, status: created.status },
      },
    });

    return created;
  });

  revalidatePath("/dashboard");
  return { success: true, data: { queueId: queue.id } };
}

export async function assignTherapist(queueId: string, therapistId: string): Promise<ActionResult> {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue || queue.deletedAt) return { success: false, error: "ไม่พบคิว" };

  const session = await requireStaffSession(queue.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (queue.status !== QueueStatus.WAITING && queue.status !== QueueStatus.ASSIGNED) {
    return { success: false, error: "ไม่สามารถมอบหมายหมอนวดได้ในสถานะนี้" };
  }
  if (await isTherapistBusy(therapistId)) {
    return { success: false, error: "หมอนวดคนนี้กำลังนวดลูกค้าคนอื่นอยู่" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.queue.update({
      where: { id: queueId },
      data: { therapistId, status: QueueStatus.ASSIGNED },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: queue.branchId,
        action: "ASSIGN_THERAPIST",
        entityType: "Queue",
        entityId: queueId,
        beforeData: { therapistId: queue.therapistId, status: queue.status },
        afterData: { therapistId, status: QueueStatus.ASSIGNED },
      },
    });
  });

  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function startService(queueId: string, bedLabel?: string): Promise<ActionResult> {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue || queue.deletedAt) return { success: false, error: "ไม่พบคิว" };

  const session = await requireStaffSession(queue.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (!queue.therapistId) return { success: false, error: "กรุณามอบหมายหมอนวดก่อนเริ่มนวด" };
  if (queue.status !== QueueStatus.WAITING && queue.status !== QueueStatus.ASSIGNED) {
    return { success: false, error: "ไม่สามารถเริ่มนวดได้ในสถานะนี้" };
  }
  if (await isTherapistBusy(queue.therapistId)) {
    return { success: false, error: "หมอนวดคนนี้กำลังนวดลูกค้าคนอื่นอยู่" };
  }

  const nextBedLabel = bedLabel?.trim() || queue.bedLabel;

  await prisma.$transaction(async (tx) => {
    await tx.queue.update({
      where: { id: queueId },
      data: { status: QueueStatus.IN_PROGRESS, startedAt: new Date(), bedLabel: nextBedLabel },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: queue.branchId,
        action: "UPDATE",
        entityType: "Queue",
        entityId: queueId,
        beforeData: { status: queue.status },
        afterData: { status: QueueStatus.IN_PROGRESS, bedLabel: nextBedLabel },
      },
    });
  });

  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function completeService(queueId: string): Promise<ActionResult> {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue || queue.deletedAt) return { success: false, error: "ไม่พบคิว" };

  const session = await requireStaffSession(queue.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (queue.status !== QueueStatus.IN_PROGRESS) {
    return { success: false, error: "ไม่สามารถเช็คเอาท์ได้ในสถานะนี้" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.queue.update({
      where: { id: queueId },
      data: { status: QueueStatus.DONE, completedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: queue.branchId,
        action: "CHECK_OUT",
        entityType: "Queue",
        entityId: queueId,
        beforeData: { status: queue.status },
        afterData: { status: QueueStatus.DONE },
      },
    });

    // Keep the linked Booking (if any) consistent with what the customer sees on /account.
    if (queue.bookingId) {
      await tx.booking.update({ where: { id: queue.bookingId }, data: { status: BookingStatus.COMPLETED } });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/account");
  return { success: true, data: undefined };
}

export async function cancelQueue(queueId: string): Promise<ActionResult> {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue || queue.deletedAt) return { success: false, error: "ไม่พบคิว" };

  const session = await requireStaffSession(queue.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (queue.status === QueueStatus.DONE || queue.status === QueueStatus.CANCELLED) {
    return { success: false, error: "ไม่สามารถยกเลิกคิวนี้ได้" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.queue.update({
      where: { id: queueId },
      data: { status: QueueStatus.CANCELLED, cancelledAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: queue.branchId,
        action: "UPDATE",
        entityType: "Queue",
        entityId: queueId,
        beforeData: { status: queue.status },
        afterData: { status: QueueStatus.CANCELLED },
      },
    });
  });

  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}
