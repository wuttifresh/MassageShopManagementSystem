import { ScheduleStatus, BookingStatus, TherapistStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/// Candidate slots are generated on this grid. Doesn't need to be configurable per-service for
/// Phase 3 — every service option's duration is checked against the grid regardless.
const SLOT_STEP_MINUTES = 30;

/// Minimum notice required for a same-day booking, so a customer can't book a slot 2 minutes
/// from now that staff have no realistic chance to prepare for.
const MIN_LEAD_TIME_MINUTES = 60;

/// Bookings in these statuses still hold the therapist's time and must block other bookings.
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

export type TimeRange = { start: Date; end: Date };

function dateOnly(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10));
}

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const combined = new Date(date);
  combined.setUTCHours(hours, minutes, 0, 0);
  return combined;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/// Therapists at a branch who are active and capable of performing the given service.
///
/// Specialty is a preference, not a hard capability gate: if no therapist at the branch has
/// this service listed as a specialty yet (a common gap right after a branch/service is set
/// up), fall back to every active therapist at the branch instead of returning an empty list —
/// otherwise staff would see a dropdown with no names at all and no way to book anyone.
export async function getEligibleTherapists(branchId: string, serviceId: string) {
  const bySpecialty = await prisma.therapist.findMany({
    where: {
      branchId,
      status: TherapistStatus.ACTIVE,
      deletedAt: null,
      specialties: { some: { serviceId } },
    },
    orderBy: { nickname: "asc" },
  });
  if (bySpecialty.length > 0) return bySpecialty;

  return prisma.therapist.findMany({
    where: { branchId, status: TherapistStatus.ACTIVE, deletedAt: null },
    orderBy: { nickname: "asc" },
  });
}

async function getWorkingWindow(therapistId: string, date: Date): Promise<TimeRange | null> {
  const schedule = await prisma.therapistSchedule.findUnique({
    where: { therapistId_date: { therapistId, date: dateOnly(date) } },
  });
  if (!schedule || schedule.status !== ScheduleStatus.WORKING) return null;
  if (!schedule.startTime || !schedule.endTime) return null;

  return {
    start: combineDateAndTime(date, schedule.startTime),
    end: combineDateAndTime(date, schedule.endTime),
  };
}

async function getBookedRanges(therapistId: string, date: Date): Promise<TimeRange[]> {
  const dayStart = combineDateAndTime(date, "00:00");
  const dayEnd = combineDateAndTime(date, "23:59");

  const bookings = await prisma.booking.findMany({
    where: {
      therapistId,
      deletedAt: null,
      status: { in: ACTIVE_BOOKING_STATUSES },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    select: { startTime: true, endTime: true },
  });

  return bookings.map((b) => ({ start: b.startTime, end: b.endTime }));
}

function generateCandidateSlots(
  window: TimeRange,
  durationMinutes: number,
  bookedRanges: TimeRange[],
  now: Date
): Date[] {
  const slots: Date[] = [];
  const earliestStart = new Date(now.getTime() + MIN_LEAD_TIME_MINUTES * 60_000);

  let cursor = new Date(window.start);
  while (cursor.getTime() + durationMinutes * 60_000 <= window.end.getTime()) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
    const isPastLeadTime = cursor >= earliestStart;
    const isFree = bookedRanges.every((r) => !rangesOverlap(cursor, slotEnd, r.start, r.end));

    if (isPastLeadTime && isFree) slots.push(new Date(cursor));

    cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60_000);
  }

  return slots;
}

/// All free start times for one specific therapist on a given date.
export async function getTherapistSlots(
  therapistId: string,
  date: Date,
  durationMinutes: number
): Promise<Date[]> {
  const window = await getWorkingWindow(therapistId, date);
  if (!window) return [];

  const bookedRanges = await getBookedRanges(therapistId, date);
  return generateCandidateSlots(window, durationMinutes, bookedRanges, new Date());
}

/// Union of start times where at least one eligible therapist at the branch is free — used to
/// render the picker when the customer selects "คนไหนก็ได้" (any therapist).
export async function getAnyTherapistSlots(
  branchId: string,
  serviceId: string,
  date: Date,
  durationMinutes: number
): Promise<Date[]> {
  const therapists = await getEligibleTherapists(branchId, serviceId);
  const perTherapistSlots = await Promise.all(
    therapists.map((t) => getTherapistSlots(t.id, date, durationMinutes))
  );

  const uniqueTimes = new Map<number, Date>();
  for (const slots of perTherapistSlots) {
    for (const slot of slots) uniqueTimes.set(slot.getTime(), slot);
  }

  return Array.from(uniqueTimes.values()).sort((a, b) => a.getTime() - b.getTime());
}

/// Picks one concrete, currently-free therapist for a booking request. If `preferredTherapistId`
/// is set, only that therapist is checked (used when the customer picked a specific person).
/// Otherwise every eligible therapist at the branch is checked and the first free one is used —
/// this is what makes "คนไหนก็ได้" bookings resolve to a real therapist_id at creation time, so
/// the database EXCLUDE constraint (hard rule #6) actually protects them.
export async function findAvailableTherapist(
  branchId: string,
  serviceId: string,
  startTime: Date,
  endTime: Date,
  preferredTherapistId?: string | null
): Promise<string | null> {
  const therapists = preferredTherapistId
    ? await prisma.therapist.findMany({
        where: { id: preferredTherapistId, branchId, status: TherapistStatus.ACTIVE, deletedAt: null },
      })
    : await getEligibleTherapists(branchId, serviceId);

  for (const therapist of therapists) {
    const window = await getWorkingWindow(therapist.id, startTime);
    if (!window || startTime < window.start || endTime > window.end) continue;

    const bookedRanges = await getBookedRanges(therapist.id, startTime);
    const isFree = bookedRanges.every((r) => !rangesOverlap(startTime, endTime, r.start, r.end));
    if (isFree) return therapist.id;
  }

  return null;
}
