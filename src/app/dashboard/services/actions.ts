"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff-auth";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export type ServiceInput = {
  name: string;
  category?: string;
  description?: string;
  options: { durationMinutes: string; price: string }[];
};

function validateServiceInput(input: ServiceInput): string | null {
  if (!input.name.trim()) return "กรุณาระบุชื่อบริการ";
  if (input.options.length === 0) return "กรุณาเพิ่มระยะเวลาอย่างน้อย 1 รายการ";

  const seenDurations = new Set<number>();
  for (const option of input.options) {
    const duration = Number(option.durationMinutes);
    const price = Number(option.price);
    if (!Number.isInteger(duration) || duration <= 0) return "ระยะเวลาต้องเป็นจำนวนเต็มมากกว่า 0";
    if (Number.isNaN(price) || price < 0) return "ราคาต้องไม่ติดลบ";
    if (seenDurations.has(duration)) return `มีระยะเวลา ${duration} นาทีซ้ำกัน`;
    seenDurations.add(duration);
  }

  return null;
}

export async function createService(input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const validationError = validateServiceInput(input);
  if (validationError) return { success: false, error: validationError };

  const service = await prisma.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        name: input.name.trim(),
        category: input.category?.trim() || null,
        description: input.description?.trim() || null,
        options: {
          create: input.options.map((o) => ({
            durationMinutes: Number(o.durationMinutes),
            price: o.price,
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "CREATE",
        entityType: "Service",
        entityId: created.id,
        afterData: { name: created.name, options: input.options },
      },
    });

    return created;
  });

  revalidatePath("/dashboard/services");
  return { success: true, data: { id: service.id } };
}

export type ServiceUpdateInput = {
  name: string;
  category?: string;
  description?: string;
  isActive: boolean;
};

export async function updateService(id: string, input: ServiceUpdateInput): Promise<ActionResult> {
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { success: false, error: "ไม่พบบริการ" };

  const session = await requireStaffSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  if (!input.name.trim()) return { success: false, error: "กรุณาระบุชื่อบริการ" };

  await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id },
      data: {
        name: input.name.trim(),
        category: input.category?.trim() || null,
        description: input.description?.trim() || null,
        isActive: input.isActive,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "UPDATE",
        entityType: "Service",
        entityId: id,
        beforeData: { name: existing.name, isActive: existing.isActive },
        afterData: { name: input.name, isActive: input.isActive },
      },
    });
  });

  revalidatePath("/dashboard/services");
  revalidatePath(`/dashboard/services/${id}`);
  return { success: true, data: undefined };
}

export type AddServiceOptionInput = { durationMinutes: string; price: string };

export async function addServiceOption(
  serviceId: string,
  input: AddServiceOptionInput
): Promise<ActionResult<{ id: string }>> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.deletedAt) return { success: false, error: "ไม่พบบริการ" };

  const session = await requireStaffSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const validationError = validateServiceInput({ name: service.name, options: [input] });
  if (validationError) return { success: false, error: validationError };

  const duplicate = await prisma.serviceOption.findUnique({
    where: {
      serviceId_durationMinutes: { serviceId, durationMinutes: Number(input.durationMinutes) },
    },
  });
  if (duplicate) return { success: false, error: "มีระยะเวลานี้อยู่แล้ว" };

  const option = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceOption.create({
      data: { serviceId, durationMinutes: Number(input.durationMinutes), price: input.price },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "CREATE",
        entityType: "ServiceOption",
        entityId: created.id,
        afterData: { serviceId, durationMinutes: input.durationMinutes, price: input.price },
      },
    });

    return created;
  });

  revalidatePath(`/dashboard/services/${serviceId}`);
  return { success: true, data: { id: option.id } };
}

export type UpdateServiceOptionInput = {
  price: string;
  promoPrice: string; // "" = no promo
  isActive: boolean;
};

export async function updateServiceOption(
  optionId: string,
  input: UpdateServiceOptionInput
): Promise<ActionResult> {
  const existing = await prisma.serviceOption.findUnique({ where: { id: optionId } });
  if (!existing) return { success: false, error: "ไม่พบตัวเลือกบริการ" };

  const session = await requireStaffSession();
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const price = Number(input.price);
  if (Number.isNaN(price) || price < 0) return { success: false, error: "ราคาต้องไม่ติดลบ" };

  let promoPrice: number | null = null;
  if (input.promoPrice.trim() !== "") {
    promoPrice = Number(input.promoPrice);
    if (Number.isNaN(promoPrice) || promoPrice < 0) {
      return { success: false, error: "ราคาโปรโมชั่นต้องไม่ติดลบ" };
    }
    if (promoPrice >= price) {
      return { success: false, error: "ราคาโปรโมชั่นต้องน้อยกว่าราคาปกติ" };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOption.update({
      where: { id: optionId },
      data: { price, promoPrice, isActive: input.isActive },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "UPDATE",
        entityType: "ServiceOption",
        entityId: optionId,
        beforeData: {
          price: existing.price.toString(),
          promoPrice: existing.promoPrice?.toString() ?? null,
          isActive: existing.isActive,
        },
        afterData: { price, promoPrice, isActive: input.isActive },
      },
    });
  });

  revalidatePath(`/dashboard/services/${existing.serviceId}`);
  revalidatePath("/dashboard/services");
  return { success: true, data: undefined };
}
