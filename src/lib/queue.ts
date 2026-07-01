import { QueueStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function startOfToday(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

export function endOfToday(): Date {
  return new Date(startOfToday().getTime() + 24 * 60 * 60_000);
}

/// Human-facing daily sequence number, e.g. "Q014". Resets naturally every day because it's
/// derived from a count of today's queue rows, not a global counter.
export async function generateQueueNumber(branchId: string): Promise<string> {
  const count = await prisma.queue.count({
    where: { branchId, createdAt: { gte: startOfToday(), lt: endOfToday() } },
  });
  return `Q${String(count + 1).padStart(3, "0")}`;
}

/// A therapist is "busy" if they're currently in the middle of a session — used to stop staff
/// from double-booking a therapist's real-time attention (distinct from the Booking-level
/// DB constraint, which guards advance reservations).
export async function isTherapistBusy(therapistId: string): Promise<boolean> {
  const inProgress = await prisma.queue.findFirst({
    where: { therapistId, status: QueueStatus.IN_PROGRESS, deletedAt: null },
    select: { id: true },
  });
  return inProgress !== null;
}
