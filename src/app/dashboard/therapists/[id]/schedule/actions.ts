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
