import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// booking-core-client.ts imports SlotTakenError/BookingValidationError from booking-service.ts,
// which in turn imports the real @/lib/prisma and @/lib/availability — neither is needed here and
// prisma.ts would fail to construct a client against the test's generated-Prisma stand-in (see
// test/mocks/prisma-client.ts), so stub both, matching booking-service.test.ts's own pattern.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/availability", () => ({ findAvailableTherapist: vi.fn(), getAnyTherapistSlots: vi.fn(), getTherapistSlots: vi.fn() }));

import { SlotTakenError, BookingValidationError } from "@/lib/booking-service";
import { getAvailabilityFromCore, createBookingViaCore } from "@/lib/booking-core-client";

const originalFetch = global.fetch;
const originalUrl = process.env.BOOKING_CORE_URL;

beforeEach(() => {
  process.env.BOOKING_CORE_URL = "http://booking-core.test";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.BOOKING_CORE_URL = originalUrl;
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("getAvailabilityFromCore", () => {
  it("queries booking-core's availability endpoint and returns the slot list", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { slots: ["10:00", "10:30"] })) as unknown as typeof fetch;

    const slots = await getAvailabilityFromCore({ branchId: "b1", serviceOptionId: "so1", date: "2026-08-01" });

    expect(slots).toEqual(["10:00", "10:30"]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://booking-core.test/v1/availability?branchId=b1&serviceOptionId=so1&date=2026-08-01");
  });

  it("includes therapistId only when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { slots: [] })) as unknown as typeof fetch;

    await getAvailabilityFromCore({ branchId: "b1", serviceOptionId: "so1", date: "2026-08-01", therapistId: "t1" });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("therapistId=t1");
  });

  it("throws when booking-core is unreachable/configured wrong", async () => {
    delete process.env.BOOKING_CORE_URL;
    await expect(getAvailabilityFromCore({ branchId: "b1", serviceOptionId: "so1", date: "2026-08-01" })).rejects.toThrow(
      "BOOKING_CORE_URL is not configured"
    );
  });
});

describe("createBookingViaCore", () => {
  it("posts the channel-linked customer shape and returns the created booking", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        bookingId: "bk1",
        code: "BK-TEST",
        startTime: "2026-08-01T10:00:00Z",
        endTime: "2026-08-01T11:00:00Z",
      })
    ) as unknown as typeof fetch;

    const result = await createBookingViaCore({
      branchId: "b1",
      serviceOptionId: "so1",
      therapistId: null,
      date: "2026-08-01",
      time: "10:00",
      source: "ONLINE",
      customer: { channel: "WEB", channelUserId: "+66812345678", name: "Somchai", phone: "+66812345678" },
    });

    expect(result).toEqual({
      id: "bk1",
      code: "BK-TEST",
      startTime: new Date("2026-08-01T10:00:00Z"),
      endTime: new Date("2026-08-01T11:00:00Z"),
    });

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      channel: "WEB",
      channelUserId: "+66812345678",
      guestName: "Somchai",
      therapistId: "",
    });
  });

  it("throws SlotTakenError on a 409", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(409, { error: "slot taken" })) as unknown as typeof fetch;

    await expect(
      createBookingViaCore({
        branchId: "b1",
        serviceOptionId: "so1",
        therapistId: null,
        date: "2026-08-01",
        time: "10:00",
        source: "ONLINE",
        customer: { name: "Somchai" },
      })
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("throws BookingValidationError on a 400", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(400, { error: "bad input" })) as unknown as typeof fetch;

    await expect(
      createBookingViaCore({
        branchId: "b1",
        serviceOptionId: "so1",
        therapistId: null,
        date: "2026-08-01",
        time: "10:00",
        source: "ONLINE",
        customer: { name: "Somchai" },
      })
    ).rejects.toBeInstanceOf(BookingValidationError);
  });
});
