"use server";

import { revalidatePath } from "next/cache";
import { ScheduleStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff-auth";

type ActionResult = { success: true } | { success: false; error: string };

export async function upsertScheduleDay(
  therapistId: string,
  date: string, // YYYY-MM-DD
  status: ScheduleStatus,
  startTime: string | null,
  endTime: string | null
): Promise<ActionResult> {
  const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } });
  if (!therapist || therapist.deletedAt) return { success: false, error: "ไม่พบหมอนวด" };

  const session = await requireStaffSession(therapist.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  if (status === ScheduleStatus.WORKING && (!startTime || !endTime)) {
    return { success: false, error: "กรุณาระบุเวลาเริ่ม-เลิกงาน" };
  }

  const scheduleDate = new Date(date);
  const finalStartTime = status === ScheduleStatus.WORKING ? startTime : null;
  const finalEndTime = status === ScheduleStatus.WORKING ? endTime : null;

  const existing = await prisma.therapistSchedule.findUnique({
    where: { therapistId_date: { therapistId, date: scheduleDate } },
  });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.therapistSchedule.upsert({
      where: { therapistId_date: { therapistId, date: scheduleDate } },
      update: { status, startTime: finalStartTime, endTime: finalEndTime },
      create: {
        therapistId,
        branchId: therapist.branchId,
        date: scheduleDate,
        status,
        startTime: finalStartTime,
        endTime: finalEndTime,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: therapist.branchId,
        action: "UPDATE",
        entityType: "TherapistSchedule",
        entityId: updated.id,
        beforeData: existing
          ? { status: existing.status, startTime: existing.startTime, endTime: existing.endTime }
          : undefined,
        afterData: { status, startTime: finalStartTime, endTime: finalEndTime },
      },
    });
  });

  revalidatePath(`/dashboard/therapists/${therapistId}/schedule`);
  return { success: true };
}

/// A time block holds a therapist's time on one date (lunch break, personal appointment, etc.) —
/// availability.ts's getBusyRanges treats it exactly like a booking, so once created it
/// immediately narrows both /book-now and the Go booking-core's slot calculation.
export async function createTimeBlock(
  therapistId: string,
  date: string, // YYYY-MM-DD
  startTime: string,
  endTime: string,
  reason: string
): Promise<ActionResult> {
  const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } });
  if (!therapist || therapist.deletedAt) return { success: false, error: "ไม่พบหมอนวด" };

  const session = await requireStaffSession(therapist.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  if (!startTime || !endTime || startTime >= endTime) {
    return { success: false, error: "ช่วงเวลาไม่ถูกต้อง" };
  }

  await prisma.$transaction(async (tx) => {
    const block = await tx.therapistTimeBlock.create({
      data: {
        therapistId,
        branchId: therapist.branchId,
        date: new Date(date),
        startTime,
        endTime,
        reason: reason || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: therapist.branchId,
        action: "CREATE",
        entityType: "TherapistTimeBlock",
        entityId: block.id,
        afterData: { date, startTime, endTime, reason: reason || null },
      },
    });
  });

  revalidatePath(`/dashboard/therapists/${therapistId}/schedule`);
  return { success: true };
}

export async function deleteTimeBlock(therapistId: string, timeBlockId: string): Promise<ActionResult> {
  const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } });
  if (!therapist || therapist.deletedAt) return { success: false, error: "ไม่พบหมอนวด" };

  const session = await requireStaffSession(therapist.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const block = await prisma.therapistTimeBlock.findUnique({ where: { id: timeBlockId } });
  if (!block || block.therapistId !== therapistId) return { success: false, error: "ไม่พบช่วงเวลาที่บล็อก" };

  await prisma.$transaction(async (tx) => {
    await tx.therapistTimeBlock.delete({ where: { id: timeBlockId } });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: therapist.branchId,
        action: "DELETE",
        entityType: "TherapistTimeBlock",
        entityId: timeBlockId,
        beforeData: {
          date: block.date.toISOString().slice(0, 10),
          startTime: block.startTime,
          endTime: block.endTime,
          reason: block.reason,
        },
      },
    });
  });

  revalidatePath(`/dashboard/therapists/${therapistId}/schedule`);
  return { success: true };
}
