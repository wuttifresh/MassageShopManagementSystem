import { Role } from "@/generated/prisma/client";
import { getCurrentSession } from "@/lib/session";

/// OWNER can act on anything; STAFF can only act within their own branch. Pass `branchId` to
/// scope-check a branch-specific resource (queue, therapist schedule); omit it for resources
/// that aren't branch-specific (the shared service catalog).
export async function requireStaffSession(branchId?: string) {
  const session = await getCurrentSession();
  if (!session?.user) return null;
  if (session.user.role !== Role.OWNER && session.user.role !== Role.STAFF) return null;
  if (branchId && session.user.role === Role.STAFF && session.user.branchId !== branchId) return null;
  return session;
}
