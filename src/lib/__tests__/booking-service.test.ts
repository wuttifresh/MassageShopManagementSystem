import { describe, expect, it, vi, beforeEach } from "vitest";
import { DriverAdapterError } from "@prisma/driver-adapter-utils";

// See test/mocks/prisma-client.ts (wired via vitest.config.ts) for why the generated Prisma
// client — which booking-service.ts imports the Channel enum value from — needs a stand-in here.

// vi.hoisted() is required (rather than plain top-level consts) because vi.mock() factories
// below are hoisted above everything else in the file — Vitest's documented pattern for
// referencing mock fns from within a vi.mock() factory.
const { serviceOptionFindUnique, branchFindUnique, transactionMock, findAvailableTherapist, getAnyTherapistSlots, getTherapistSlots } =
  vi.hoisted(() => ({
    serviceOptionFindUnique: vi.fn(),
    branchFindUnique: vi.fn(),
    transactionMock: vi.fn(),
    findAvailableTherapist: vi.fn(),
    getAnyTherapistSlots: vi.fn(),
    getTherapistSlots: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    serviceOption: { findUnique: serviceOptionFindUnique },
    branch: { findUnique: branchFindUnique },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/availability", () => ({
  findAvailableTherapist,
  getAnyTherapistSlots,
  getTherapistSlots,
}));

import { createBooking, getAvailableSlots, SlotTakenError, BookingValidationError } from "@/lib/booking-service";

const VALID_SERVICE_OPTION = { id: "so-1", serviceId: "svc-1", durationMinutes: 60, isActive: true };
const VALID_BRANCH = { id: "branch-1", name: "Test Branch" };

/// Tomorrow's date, formatted as YYYY-MM-DD — always well past the 1-hour minimum lead time
/// regardless of when the suite runs.
function tomorrow(): string {
  const d = new Date(Date.now() + 24 * 60 * 60_000);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  serviceOptionFindUnique.mockReset();
  branchFindUnique.mockReset();
  transactionMock.mockReset();
  findAvailableTherapist.mockReset();
  getAnyTherapistSlots.mockReset();
  getTherapistSlots.mockReset();
});

describe("createBooking — concurrent booking / overlap", () => {
  it("throws SlotTakenError when the DB's exclusion constraint rejects a race-condition double-booking", async () => {
    serviceOptionFindUnique.mockResolvedValue(VALID_SERVICE_OPTION);
    branchFindUnique.mockResolvedValue(VALID_BRANCH);
    findAvailableTherapist.mockResolvedValue("therapist-1");

    let call = 0;
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      call += 1;
      if (call === 2) {
        // Simulates two requests racing for the same therapist/time: the first commits, and the
        // second is rejected by Postgres's `bookings_no_therapist_overlap` EXCLUDE constraint —
        // this is the actual guarantee against the race, not the findAvailableTherapist check
        // above (which is only a best-effort pre-check and can't see the other request in flight).
        throw new DriverAdapterError({
          kind: "postgres",
          code: "23P01",
          severity: "ERROR",
          message: "conflicting key value violates exclusion constraint",
          detail: undefined,
          column: undefined,
          hint: undefined,
        });
      }
      const tx = {
        customer: { upsert: vi.fn() },
        booking: {
          create: vi.fn().mockResolvedValue({
            id: "booking-1",
            code: "BK-TEST",
            startTime: new Date(),
            endTime: new Date(),
            therapistId: "therapist-1",
            channel: null,
          }),
        },
        auditLog: { create: vi.fn() },
      };
      return callback(tx);
    });

    const input = {
      branchId: "branch-1",
      serviceOptionId: "so-1",
      therapistId: null,
      date: tomorrow(),
      time: "10:00",
      source: "ONLINE" as const,
      customer: { type: "user" as const, userId: "user-1" },
    };

    const first = await createBooking(input);
    expect(first.id).toBe("booking-1");

    await expect(createBooking(input)).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("throws SlotTakenError when no therapist is free at all (app-level pre-check)", async () => {
    serviceOptionFindUnique.mockResolvedValue(VALID_SERVICE_OPTION);
    branchFindUnique.mockResolvedValue(VALID_BRANCH);
    findAvailableTherapist.mockResolvedValue(null);

    await expect(
      createBooking({
        branchId: "branch-1",
        serviceOptionId: "so-1",
        therapistId: null,
        date: tomorrow(),
        time: "10:00",
        source: "ONLINE" as const,
        customer: { type: "user" as const, userId: "user-1" },
      })
    ).rejects.toBeInstanceOf(SlotTakenError);

    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe("createBooking — validation", () => {
  it("throws BookingValidationError for an unknown service option", async () => {
    serviceOptionFindUnique.mockResolvedValue(null);

    await expect(
      createBooking({
        branchId: "branch-1",
        serviceOptionId: "does-not-exist",
        therapistId: null,
        date: tomorrow(),
        time: "10:00",
        source: "ONLINE" as const,
        customer: { type: "user" as const, userId: "user-1" },
      })
    ).rejects.toBeInstanceOf(BookingValidationError);
  });

  it("throws BookingValidationError when booking less than 1 hour in advance", async () => {
    serviceOptionFindUnique.mockResolvedValue(VALID_SERVICE_OPTION);
    branchFindUnique.mockResolvedValue(VALID_BRANCH);

    const soon = new Date(Date.now() + 5 * 60_000); // 5 minutes from now
    await expect(
      createBooking({
        branchId: "branch-1",
        serviceOptionId: "so-1",
        therapistId: null,
        date: soon.toISOString().slice(0, 10),
        time: `${String(soon.getUTCHours()).padStart(2, "0")}:${String(soon.getUTCMinutes()).padStart(2, "0")}`,
        source: "ONLINE" as const,
        customer: { type: "user" as const, userId: "user-1" },
      })
    ).rejects.toBeInstanceOf(BookingValidationError);

    expect(findAvailableTherapist).not.toHaveBeenCalled();
  });
});

describe("getAvailableSlots", () => {
  it("caps results at 50 slots", async () => {
    serviceOptionFindUnique.mockResolvedValue(VALID_SERVICE_OPTION);
    const manySlots = Array.from({ length: 80 }, (_, i) => new Date(Date.now() + i * 30 * 60_000));
    getAnyTherapistSlots.mockResolvedValue(manySlots);

    const slots = await getAvailableSlots({ branchId: "branch-1", serviceOptionId: "so-1", date: new Date() });
    expect(slots).toHaveLength(50);
  });

  it("queries a single therapist's slots when therapistId is given instead of the branch-wide union", async () => {
    serviceOptionFindUnique.mockResolvedValue(VALID_SERVICE_OPTION);
    getTherapistSlots.mockResolvedValue([]);

    await getAvailableSlots({ branchId: "branch-1", serviceOptionId: "so-1", date: new Date(), therapistId: "therapist-1" });

    expect(getTherapistSlots).toHaveBeenCalledWith("therapist-1", expect.any(Date), 60);
    expect(getAnyTherapistSlots).not.toHaveBeenCalled();
  });
});
