import { prisma } from "@/lib/prisma";

/// A booking's *display* channel: `channel` (LINE/WHATSAPP) when set by the multi-channel entry
/// points (multi-channel-booking-prompt.md, Phases 2-4), else falls back to `source`
/// (ONLINE/WALK_IN/PHONE/ADMIN) for bookings made through the pre-existing paths — see the
/// `Channel` enum's doc comment in schema.prisma for why these are two separate fields.
export const BOOKING_CHANNEL_KEYS = ["LINE", "WHATSAPP", "ONLINE", "WALK_IN", "PHONE", "ADMIN"] as const;
export type BookingChannelKey = (typeof BOOKING_CHANNEL_KEYS)[number];

export type ChannelCountRow = { channel: BookingChannelKey; count: number };
export type DailyChannelRow = { date: string; counts: Record<BookingChannelKey, number>; total: number };
export type MonthlyChannelRow = { month: string; counts: Record<BookingChannelKey, number>; total: number };

export type BookingChannelReport = {
  total: number;
  byChannel: ChannelCountRow[];
  byDay: DailyChannelRow[];
  byMonth: MonthlyChannelRow[];
};

function resolveChannelKey(booking: { channel: string | null; source: string }): BookingChannelKey {
  return (booking.channel as BookingChannelKey | null) ?? (booking.source as BookingChannelKey);
}

function emptyCounts(): Record<BookingChannelKey, number> {
  return { LINE: 0, WHATSAPP: 0, ONLINE: 0, WALK_IN: 0, PHONE: 0, ADMIN: 0 };
}

/// Counts bookings by channel for a branch/date range — multi-channel-booking-prompt.md, Phase 6
/// ("สัดส่วน booking แยกตาม channel รายวัน/รายเดือน"). A pure booking-count metric, unrelated to
/// getSalesReport (which aggregates *paid Transactions*, not Bookings — a channel booking may
/// never reach POS, and a walk-in sale may have no Booking at all).
export async function getBookingChannelReport({
  branchId,
  startDate,
  endDate,
}: {
  /// Omit to aggregate across every branch.
  branchId?: string;
  startDate: Date;
  endDate: Date;
}): Promise<BookingChannelReport> {
  const bookings = await prisma.booking.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      deletedAt: null,
      createdAt: { gte: startDate, lt: endDate },
    },
    select: { channel: true, source: true, createdAt: true },
  });

  const byChannelMap = new Map<BookingChannelKey, number>();
  const byDayMap = new Map<string, Record<BookingChannelKey, number>>();
  const byMonthMap = new Map<string, Record<BookingChannelKey, number>>();

  for (const booking of bookings) {
    const key = resolveChannelKey(booking);
    byChannelMap.set(key, (byChannelMap.get(key) ?? 0) + 1);

    const dayKey = booking.createdAt.toISOString().slice(0, 10);
    const dayCounts = byDayMap.get(dayKey) ?? emptyCounts();
    dayCounts[key] += 1;
    byDayMap.set(dayKey, dayCounts);

    const monthKey = dayKey.slice(0, 7);
    const monthCounts = byMonthMap.get(monthKey) ?? emptyCounts();
    monthCounts[key] += 1;
    byMonthMap.set(monthKey, monthCounts);
  }

  const sumCounts = (counts: Record<BookingChannelKey, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    total: bookings.length,
    byChannel: BOOKING_CHANNEL_KEYS.map((channel) => ({ channel, count: byChannelMap.get(channel) ?? 0 })).filter(
      (row) => row.count > 0
    ),
    byDay: Array.from(byDayMap.entries())
      .map(([date, counts]) => ({ date, counts, total: sumCounts(counts) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byMonth: Array.from(byMonthMap.entries())
      .map(([month, counts]) => ({ month, counts, total: sumCounts(counts) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
