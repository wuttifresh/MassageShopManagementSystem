"use server";

import { revalidatePath } from "next/cache";
import { CommissionType, TherapistStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff-auth";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export type TherapistInput = {
  branchId: string;
  nickname: string;
  bio?: string;
  commissionType: CommissionType;
  commissionRate: string;
  specialtyServiceIds: string[];
};

function validateInput(input: Omit<TherapistInput, "branchId">): string | null {
  if (!input.nickname.trim()) return "กรุณาระบุชื่อเล่นหมอนวด";
  const rate = Number(input.commissionRate);
  if (Number.isNaN(rate) || rate < 0) return "อัตราค่ามือไม่ถูกต้อง";
  if (input.commissionType === CommissionType.PERCENTAGE && rate > 100) {
    return "เปอร์เซ็นต์ค่ามือต้องไม่เกิน 100";
  }
  if (input.specialtyServiceIds.length === 0) return "กรุณาเลือกความถนัดอย่างน้อย 1 บริการ";
  return null;
}

export async function createTherapist(input: TherapistInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireStaffSession(input.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  const therapist = await prisma.$transaction(async (tx) => {
    const created = await tx.therapist.create({
      data: {
        branchId: input.branchId,
        nickname: input.nickname.trim(),
        bio: input.bio?.trim() || null,
        commissionType: input.commissionType,
        commissionRate: input.commissionRate,
        specialties: { create: input.specialtyServiceIds.map((serviceId) => ({ serviceId })) },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: input.branchId,
        action: "CREATE",
        entityType: "Therapist",
        entityId: created.id,
        afterData: {
          nickname: created.nickname,
          commissionType: created.commissionType,
          commissionRate: input.commissionRate,
          specialtyServiceIds: input.specialtyServiceIds,
        },
      },
    });

    return created;
  });

  revalidatePath("/dashboard/therapists");
  return { success: true, data: { id: therapist.id } };
}

export type TherapistUpdateInput = Omit<TherapistInput, "branchId"> & { status: TherapistStatus };

export async function updateTherapist(id: string, input: TherapistUpdateInput): Promise<ActionResult> {
  const existing = await prisma.therapist.findUnique({
    where: { id },
    include: { specialties: true },
  });
  if (!existing || existing.deletedAt) return { success: false, error: "ไม่พบหมอนวด" };

  const session = await requireStaffSession(existing.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  await prisma.$transaction(async (tx) => {
    await tx.therapist.update({
      where: { id },
      data: {
        nickname: input.nickname.trim(),
        bio: input.bio?.trim() || null,
        status: input.status,
        commissionType: input.commissionType,
        commissionRate: input.commissionRate,
      },
    });

    // Replace the specialty set wholesale — simplest correct approach for a small checkbox list.
    await tx.therapistService.deleteMany({ where: { therapistId: id } });
    await tx.therapistService.createMany({
      data: input.specialtyServiceIds.map((serviceId) => ({ therapistId: id, serviceId })),
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: existing.branchId,
        action: "UPDATE",
        entityType: "Therapist",
        entityId: id,
        beforeData: {
          nickname: existing.nickname,
          status: existing.status,
          commissionType: existing.commissionType,
          commissionRate: existing.commissionRate.toString(),
          specialtyServiceIds: existing.specialties.map((s) => s.serviceId),
        },
        afterData: {
          nickname: input.nickname,
          status: input.status,
          commissionType: input.commissionType,
          commissionRate: input.commissionRate,
          specialtyServiceIds: input.specialtyServiceIds,
        },
      },
    });
  });

  revalidatePath("/dashboard/therapists");
  revalidatePath(`/dashboard/therapists/${id}`);
  return { success: true, data: undefined };
}
