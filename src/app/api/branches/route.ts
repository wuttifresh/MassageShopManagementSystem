import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// No request-time API (cookies/headers/searchParams) is used here, so Next.js would otherwise
// treat this as a static route and bake the branch list in at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, slug: true, address: true, openTime: true, closeTime: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ branches });
}
