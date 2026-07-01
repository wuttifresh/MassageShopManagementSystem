"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff-auth";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export type SellPackageInput = {
  customerId: string;
  branchId: string;
  serviceId: string | null;
  name: string;
  totalSessions: string;
  pricePaid: string;
  expiresAt?: string;
};

export async function sellPackage(input: SellPackageInput): Promise<ActionResult<{ packageId: string }>> {
  const session = await requireStaffSession(input.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  if (!input.name.trim()) return { success: false, error: "กรุณาระบุชื่อคอร์ส" };

  const totalSessions = Number(input.totalSessions);
  if (!Number.isInteger(totalSessions) || totalSessions <= 0) {
    return { success: false, error: "จำนวนครั้งต้องเป็นจำนวนเต็มมากกว่า 0" };
  }

  const pricePaid = Number(input.pricePaid);
  if (Number.isNaN(pricePaid) || pricePaid < 0) return { success: false, error: "ราคาต้องไม่ติดลบ" };

  const customer = await prisma.user.findUnique({ where: { id: input.customerId } });
  if (!customer || customer.role !== "CUSTOMER") return { success: false, error: "ไม่พบลูกค้า" };

  const pkg = await prisma.$transaction(async (tx) => {
    const created = await tx.package.create({
      data: {
        branchId: input.branchId,
        customerId: input.customerId,
        serviceId: input.serviceId,
        name: input.name.trim(),
        totalSessions,
        remainingSessions: totalSessions,
        pricePaid,
        soldById: session.user.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: input.branchId,
        action: "CREATE",
        entityType: "Package",
        entityId: created.id,
        afterData: {
          name: created.name,
          totalSessions,
          pricePaid,
          customerId: input.customerId,
          serviceId: input.serviceId,
        },
      },
    });

    return created;
  });

  revalidatePath(`/dashboard/customers/${input.customerId}`);
  return { success: true, data: { packageId: pkg.id } };
}
