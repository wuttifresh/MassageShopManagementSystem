import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, slug: true, address: true, openTime: true, closeTime: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ branches });
}
