import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      options: { some: { isActive: true } },
    },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      options: {
        where: { isActive: true },
        select: { id: true, durationMinutes: true, price: true },
        orderBy: { durationMinutes: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services });
}
