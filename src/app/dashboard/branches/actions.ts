"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/// Managing branches (and who's assigned to them) is OWNER-only — unlike day-to-day catalog
/// edits (Phase 5), standing up or reconfiguring a whole location is a different order of
/// decision, so it doesn't get the same "OWNER and STAFF are equal" treatment as therapists/services.
async function requireOwnerSession() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== "OWNER") return null;
  return session;
}

export type BranchInput = {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  openTime: string;
  closeTime: string;
};

function validateInput(input: BranchInput): string | null {
  if (!input.name.trim()) return "กรุณาระบุชื่อสาขา";
  if (!/^[a-z0-9-]+$/.test(input.slug)) return "slug ต้องเป็นตัวพิมพ์เล็ก ตัวเลข และขีดกลางเท่านั้น";
  return null;
}

export async function createBranch(input: BranchInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireOwnerSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  const existing = await prisma.branch.findUnique({ where: { slug: input.slug } });
  if (existing) return { success: false, error: "slug นี้ถูกใช้ไปแล้ว" };

  const branch = await prisma.$transaction(async (tx) => {
    const created = await tx.branch.create({
      data: {
        name: input.name.trim(),
        slug: input.slug,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        openTime: input.openTime,
        closeTime: input.closeTime,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: created.id,
        action: "CREATE",
        entityType: "Branch",
        entityId: created.id,
        afterData: { name: created.name, slug: created.slug },
      },
    });

    return created;
  });

  revalidatePath("/dashboard/branches");
  return { success: true, data: { id: branch.id } };
}

export type BranchUpdateInput = BranchInput & { isActive: boolean };

export async function updateBranch(id: string, input: BranchUpdateInput): Promise<ActionResult> {
  const session = await requireOwnerSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { success: false, error: "ไม่พบสาขา" };

  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  if (input.slug !== existing.slug) {
    const slugTaken = await prisma.branch.findUnique({ where: { slug: input.slug } });
    if (slugTaken) return { success: false, error: "slug นี้ถูกใช้ไปแล้ว" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.branch.update({
      where: { id },
      data: {
        name: input.name.trim(),
        slug: input.slug,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        openTime: input.openTime,
        closeTime: input.closeTime,
        isActive: input.isActive,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: id,
        action: "UPDATE",
        entityType: "Branch",
        entityId: id,
        beforeData: { name: existing.name, slug: existing.slug, isActive: existing.isActive },
        afterData: { name: input.name, slug: input.slug, isActive: input.isActive },
      },
    });
  });

  revalidatePath("/dashboard/branches");
  revalidatePath(`/dashboard/branches/${id}`);
  return { success: true, data: undefined };
}
