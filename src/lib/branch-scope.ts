import type { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/// STAFF is pinned to their own branch; OWNER can pick any active branch (via `requestedBranchId`,
/// e.g. a `?branchId=` query param), defaulting to the first one.
export async function resolveActiveBranchId(
  user: { role: Role; branchId?: string | null },
  requestedBranchId?: string
): Promise<string | null> {
  if (user.role === "STAFF") return user.branchId ?? null;

  if (requestedBranchId) return requestedBranchId;

  const firstBranch = await prisma.branch.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });
  return firstBranch?.id ?? null;
}
