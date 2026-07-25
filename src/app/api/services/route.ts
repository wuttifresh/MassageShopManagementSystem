import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// No request-time API (cookies/headers/searchParams) is used here, so Next.js would otherwise
// treat this as a static route and bake the service list in at build time.
export const dynamic = "force-dynamic";

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
        select: { id: true, durationMinutes: true, price: true, promoPrice: true },
        orderBy: { durationMinutes: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services });
}
