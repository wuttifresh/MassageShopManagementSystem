"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/// Creating login credentials for other people, and deciding which branch they can act on, is
/// squarely an OWNER decision — not something STAFF should be able to do for themselves or others.
async function requireOwnerSession() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== "OWNER") return null;
  return session;
}

export type CreateStaffInput = {
  name: string;
  email: string;
  password: string;
  branchId: string;
};

export async function createStaff(input: CreateStaffInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireOwnerSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  if (!input.name.trim()) return { success: false, error: "กรุณาระบุชื่อ" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return { success: false, error: "อีเมลไม่ถูกต้อง" };
  if (input.password.length < 8) return { success: false, error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return { success: false, error: "อีเมลนี้ถูกใช้ไปแล้ว" };

  const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
  if (!branch) return { success: false, error: "ไม่พบสาขา" };

  const passwordHash = await bcrypt.hash(input.password, 10);

  const staff = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        role: Role.STAFF,
        name: input.name.trim(),
        email: input.email,
        passwordHash,
        branchId: input.branchId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: input.branchId,
        action: "CREATE",
        entityType: "User",
        entityId: created.id,
        afterData: { name: created.name, email: created.email, branchId: input.branchId },
      },
    });

    return created;
  });

  revalidatePath("/dashboard/staff");
  return { success: true, data: { id: staff.id } };
}

export async function updateStaffAssignment(
  userId: string,
  branchId: string,
  isActive: boolean
): Promise<ActionResult> {
  const session = await requireOwnerSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing || existing.role !== Role.STAFF) return { success: false, error: "ไม่พบพนักงาน" };

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return { success: false, error: "ไม่พบสาขา" };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { branchId, isActive } });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId,
        action: "UPDATE",
        entityType: "User",
        entityId: userId,
        beforeData: { branchId: existing.branchId, isActive: existing.isActive },
        afterData: { branchId, isActive },
      },
    });
  });

  revalidatePath("/dashboard/staff");
  return { success: true, data: undefined };
}
