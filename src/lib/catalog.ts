import { prisma } from "@/lib/prisma";

/// The active-branch and active-service+options lists shown to a customer picking what to book.
/// Shared by /api/branches, /api/services (used by dashboard checkout/walk-in forms) and the
/// book-now page's server-side render (see src/app/book-now/page.tsx) so both hit the same query.
export function getActiveBranches() {
  return prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, slug: true, address: true, openTime: true, closeTime: true },
    orderBy: { name: "asc" },
  });
}

export function getActiveServices() {
  return prisma.service.findMany({
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
}
