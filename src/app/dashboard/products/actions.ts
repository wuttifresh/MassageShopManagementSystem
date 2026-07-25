"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/staff-auth";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

function validateProductInput(input: { name: string; price: string; stockQuantity: string }): string | null {
  if (!input.name.trim()) return "กรุณาระบุชื่อสินค้า";
  const price = Number(input.price);
  if (Number.isNaN(price) || price < 0) return "ราคาต้องไม่ติดลบ";
  const stock = Number(input.stockQuantity);
  if (!Number.isInteger(stock) || stock < 0) return "จำนวนสต๊อกต้องเป็นจำนวนเต็มไม่ติดลบ";
  return null;
}

export type ProductInput = { branchId: string; name: string; price: string; stockQuantity: string };

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireStaffSession(input.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const validationError = validateProductInput(input);
  if (validationError) return { success: false, error: validationError };

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        branchId: input.branchId,
        name: input.name.trim(),
        price: input.price,
        stockQuantity: Number(input.stockQuantity),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: input.branchId,
        action: "CREATE",
        entityType: "Product",
        entityId: created.id,
        afterData: { name: created.name, price: input.price, stockQuantity: created.stockQuantity },
      },
    });

    return created;
  });

  revalidatePath("/dashboard/products");
  return { success: true, data: { id: product.id } };
}

export type ProductUpdateInput = { name: string; price: string; stockQuantity: string; isActive: boolean };

export async function updateProduct(id: string, input: ProductUpdateInput): Promise<ActionResult> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { success: false, error: "ไม่พบสินค้า" };

  const session = await requireStaffSession(existing.branchId);
  if (!session) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  const validationError = validateProductInput(input);
  if (validationError) return { success: false, error: validationError };

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: input.name.trim(),
        price: input.price,
        stockQuantity: Number(input.stockQuantity),
        isActive: input.isActive,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: session.user.role,
        branchId: existing.branchId,
        action: "UPDATE",
        entityType: "Product",
        entityId: id,
        beforeData: {
          name: existing.name,
          price: existing.price.toString(),
          stockQuantity: existing.stockQuantity,
          isActive: existing.isActive,
        },
        afterData: { name: input.name, price: input.price, stockQuantity: input.stockQuantity, isActive: input.isActive },
      },
    });
  });

  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${id}`);
  return { success: true, data: undefined };
}
