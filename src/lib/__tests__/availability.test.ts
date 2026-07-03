import { describe, expect, it, vi, beforeEach } from "vitest";

// See test/mocks/prisma-client.ts (wired via vitest.config.ts) for why the generated Prisma
// client — which availability.ts imports enum values from — needs a stand-in in this sandbox.

// vi.hoisted() is required (rather than plain top-level consts) because vi.mock() factories
// below are hoisted above everything else in the file, including normal variable declarations —
// this is Vitest's documented pattern for referencing mock fns from within a vi.mock() factory.
const { therapistScheduleFindUnique, bookingFindMany, therapistFindMany } = vi.hoisted(() => ({
  therapistScheduleFindUnique: vi.fn(),
  bookingFindMany: vi.fn(),
  therapistFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    therapistSchedule: { findUnique: therapistScheduleFindUnique },
    booking: { findMany: bookingFindMany },
    therapist: { findMany: therapistFindMany },
  },
}));

import { getTherapistSlots, getAnyTherapistSlots } from "@/lib/availability";

// A date far enough in the future that the 60-minute lead-time filter never excludes anything,
// regardless of when the test suite actually runs.
function futureDate(daysAhead: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

beforeEach(() => {
  therapistScheduleFindUnique.mockReset();
  bookingFindMany.mockReset();
  therapistFindMany.mockReset();
});

describe("getTherapistSlots (slot calculation)", () => {
  it("generates 30-minute-stepped slots across the whole working window when nothing is booked", async () => {
    therapistScheduleFindUnique.mockResolvedValue({ status: "WORKING", startTime: "10:00", endTime: "12:00" });
    bookingFindMany.mockResolvedValue([]);

    const slots = await getTherapistSlots("therapist-1", futureDate(3), 60);
    const hhmm = slots.map((s) => `${String(s.getUTCHours()).padStart(2, "0")}:${String(s.getUTCMinutes()).padStart(2, "0")}`);

    // 60-minute service in a 10:00–12:00 window on a 30-min grid: 10:00, 10:30, 11:00 are the
    // only starts that still fit an hour before closing; 11:30 would run past 12:00.
    expect(hhmm).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("returns no slots when the therapist isn't scheduled to work that day", async () => {
    therapistScheduleFindUnique.mockResolvedValue(null);
    bookingFindMany.mockResolvedValue([]);

    const slots = await getTherapistSlots("therapist-1", futureDate(3), 60);
    expect(slots).toEqual([]);
  });

  it("returns no slots when the day is marked as a day off", async () => {
    therapistScheduleFindUnique.mockResolvedValue({ status: "DAY_OFF", startTime: null, endTime: null });
    bookingFindMany.mockResolvedValue([]);

    const slots = await getTherapistSlots("therapist-1", futureDate(3), 60);
    expect(slots).toEqual([]);
  });
});

describe("getTherapistSlots (overlap detection)", () => {
  it("excludes slots that would overlap an existing active booking", async () => {
    therapistScheduleFindUnique.mockResolvedValue({ status: "WORKING", startTime: "10:00", endTime: "13:00" });

    const day = futureDate(3);
    const bookedStart = new Date(day);
    bookedStart.setUTCHours(11, 0, 0, 0);
    const bookedEnd = new Date(day);
    bookedEnd.setUTCHours(12, 0, 0, 0);
    bookingFindMany.mockResolvedValue([{ startTime: bookedStart, endTime: bookedEnd }]);

    const slots = await getTherapistSlots("therapist-1", day, 60);
    const hhmm = slots.map((s) => `${String(s.getUTCHours()).padStart(2, "0")}:${String(s.getUTCMinutes()).padStart(2, "0")}`);

    // 10:00 and 10:30 both end by 11:30 at the latest... 10:30 would run 10:30–11:30, which
    // overlaps the 11:00–12:00 booking, so only 10:00 (10:00–11:00, touches but doesn't overlap)
    // and 12:00 (12:00–13:00, right after the booking ends) should remain.
    expect(hhmm).toEqual(["10:00", "12:00"]);
  });
});

describe("getAnyTherapistSlots", () => {
  it("unions free slots across every eligible therapist at the branch, de-duplicated", async () => {
    therapistFindMany.mockResolvedValue([{ id: "therapist-a" }, { id: "therapist-b" }]);
    bookingFindMany.mockResolvedValue([]);

    // therapist-a works the morning, therapist-b the afternoon — together they should cover a
    // wider range of slots than either alone, with no duplicate timestamps. `.map()` over the
    // therapist array invokes getTherapistSlots (and its first await, getWorkingWindow) for each
    // therapist synchronously in order, so mockResolvedValueOnce's FIFO queue lines up a-then-b.
    therapistScheduleFindUnique
      .mockResolvedValueOnce({ status: "WORKING", startTime: "09:00", endTime: "10:00" })
      .mockResolvedValueOnce({ status: "WORKING", startTime: "14:00", endTime: "15:00" });

    const slots = await getAnyTherapistSlots("branch-1", "service-1", futureDate(3), 60);
    const hhmm = slots.map((s) => `${String(s.getUTCHours()).padStart(2, "0")}:${String(s.getUTCMinutes()).padStart(2, "0")}`);

    expect(hhmm).toEqual(["09:00", "14:00"]);
    expect(new Set(hhmm).size).toBe(hhmm.length); // no duplicates
  });
});
