import { describe, expect, it, vi, beforeEach } from "vitest";

const { bookingFindMany } = vi.hoisted(() => ({ bookingFindMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { booking: { findMany: bookingFindMany } } }));

import { getBookingChannelReport } from "@/lib/booking-channel-report";

function booking(channel: string | null, source: string, createdAt: string) {
  return { channel, source, createdAt: new Date(createdAt) };
}

beforeEach(() => {
  bookingFindMany.mockReset();
});

describe("getBookingChannelReport", () => {
  it("uses `channel` when set, falling back to `source` for pre-existing (non-multi-channel) bookings", async () => {
    bookingFindMany.mockResolvedValue([
      booking("LINE", "ONLINE", "2026-01-01T03:00:00.000Z"),
      booking("WHATSAPP", "ONLINE", "2026-01-01T04:00:00.000Z"),
      booking(null, "WALK_IN", "2026-01-01T05:00:00.000Z"),
      booking(null, "ONLINE", "2026-01-02T05:00:00.000Z"),
    ]);

    const report = await getBookingChannelReport({ branchId: "b1", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-03") });

    expect(report.total).toBe(4);
    expect(report.byChannel).toEqual(
      expect.arrayContaining([
        { channel: "LINE", count: 1 },
        { channel: "WHATSAPP", count: 1 },
        { channel: "WALK_IN", count: 1 },
        { channel: "ONLINE", count: 1 },
      ])
    );
    // Channels with zero bookings in range shouldn't clutter the proportion breakdown.
    expect(report.byChannel.find((r) => r.channel === "PHONE")).toBeUndefined();
    expect(report.byChannel.find((r) => r.channel === "ADMIN")).toBeUndefined();
  });

  it("groups by day and by month, each summing to the right total", async () => {
    bookingFindMany.mockResolvedValue([
      booking("LINE", "ONLINE", "2026-01-01T03:00:00.000Z"),
      booking("LINE", "ONLINE", "2026-01-02T03:00:00.000Z"),
      booking("WHATSAPP", "ONLINE", "2026-02-01T03:00:00.000Z"),
    ]);

    const report = await getBookingChannelReport({ startDate: new Date("2026-01-01"), endDate: new Date("2026-03-01") });

    expect(report.byDay).toEqual([
      { date: "2026-01-01", counts: expect.objectContaining({ LINE: 1 }), total: 1 },
      { date: "2026-01-02", counts: expect.objectContaining({ LINE: 1 }), total: 1 },
      { date: "2026-02-01", counts: expect.objectContaining({ WHATSAPP: 1 }), total: 1 },
    ]);
    expect(report.byMonth).toEqual([
      { month: "2026-01", counts: expect.objectContaining({ LINE: 2 }), total: 2 },
      { month: "2026-02", counts: expect.objectContaining({ WHATSAPP: 1 }), total: 1 },
    ]);
  });

  it("returns an all-zero report when there are no bookings in range", async () => {
    bookingFindMany.mockResolvedValue([]);

    const report = await getBookingChannelReport({ startDate: new Date("2026-01-01"), endDate: new Date("2026-01-02") });

    expect(report).toEqual({ total: 0, byChannel: [], byDay: [], byMonth: [] });
  });

  it("scopes the query to the given branch and date range", async () => {
    bookingFindMany.mockResolvedValue([]);
    const startDate = new Date("2026-01-01");
    const endDate = new Date("2026-02-01");

    await getBookingChannelReport({ branchId: "branch-1", startDate, endDate });

    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: "branch-1", deletedAt: null, createdAt: { gte: startDate, lt: endDate } }),
      })
    );
  });
});
