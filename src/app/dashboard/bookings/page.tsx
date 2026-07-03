import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { getBookingChannelReport, BOOKING_CHANNEL_KEYS, type BookingChannelKey } from "@/lib/booking-channel-report";
import { BookingFilterForm } from "./booking-filter-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

/// A booking's *display* channel — see the same helper's doc comment in booking-channel-report.ts
/// (kept as a tiny local copy here rather than imported: this one operates on a richer Prisma
/// `include` shape, that one on a `select`-only shape, and there's nothing to share besides the
/// one-line fallback expression).
function resolveChannelKey(booking: { channel: string | null; source: string }): BookingChannelKey {
  return (booking.channel as BookingChannelKey | null) ?? (booking.source as BookingChannelKey);
}

const CHANNEL_LABEL: Record<BookingChannelKey, string> = {
  LINE: "LINE",
  WHATSAPP: "WhatsApp",
  ONLINE: "เว็บไซต์",
  WALK_IN: "หน้าร้าน",
  PHONE: "โทรศัพท์",
  ADMIN: "แอดมิน",
};

const CHANNEL_BADGE_VARIANT: Record<BookingChannelKey, BadgeVariant> = {
  LINE: "success",
  WHATSAPP: "success",
  ONLINE: "info",
  WALK_IN: "neutral",
  PHONE: "neutral",
  ADMIN: "neutral",
};

const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาตามนัด",
  COMPLETED: "เสร็จสิ้น",
  RESCHEDULED: "เลื่อนนัดแล้ว",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(): { startDate: string; endDate: string } {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const start = new Date(today.getTime() - 29 * 86_400_000);
  return { startDate: isoDate(start), endDate: isoDate(today) };
}

/// Mirrors resolveChannelKey as a Prisma `where` fragment so the channel filter narrows the query
/// itself (and thus the `take` limit below) instead of filtering an already-limited result set,
/// which would silently under-count older matching bookings.
function channelWhereClause(channel: BookingChannelKey | null) {
  if (!channel) return {};
  if (channel === "LINE" || channel === "WHATSAPP") return { channel };
  return { channel: null, source: channel };
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { branchId?: string; startDate?: string; endDate?: string; channel?: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/bookings");
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  if (!activeBranchId) {
    return <EmptyState icon="🏢" title="ยังไม่มีสาขาที่ใช้งานอยู่" className="mt-10" />;
  }

  const defaults = defaultDateRange();
  const startDate = searchParams.startDate ?? defaults.startDate;
  const endDate = searchParams.endDate ?? defaults.endDate;
  const channelFilter = BOOKING_CHANNEL_KEYS.includes(searchParams.channel as BookingChannelKey)
    ? (searchParams.channel as BookingChannelKey)
    : null;

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(new Date(endDate).getTime() + 86_400_000);

  const [bookings, channelReport] = await Promise.all([
    prisma.booking.findMany({
      where: {
        branchId: activeBranchId,
        deletedAt: null,
        createdAt: { gte: rangeStart, lt: rangeEnd },
        ...channelWhereClause(channelFilter),
      },
      include: { serviceOption: { include: { service: true } }, therapist: true, customer: true, channelCustomer: true },
      orderBy: { startTime: "desc" },
      take: 200,
    }),
    getBookingChannelReport({ branchId: activeBranchId, startDate: rangeStart, endDate: rangeEnd }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="รายการจอง" description="ดูและกรองการจองทั้งหมดตามช่องทาง" />

      <Card>
        <BookingFilterForm
          branches={branches}
          activeBranchId={activeBranchId}
          startDate={startDate}
          endDate={endDate}
          channel={channelFilter}
          showBranchPicker={session.user.role === "OWNER"}
        />
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="ทั้งหมด" value={channelReport.total} />
        {channelReport.byChannel.map((row) => (
          <StatCard key={row.channel} label={CHANNEL_LABEL[row.channel]} value={row.count} />
        ))}
      </section>

      <Card>
        <CardHeader title={`รายการจอง (${bookings.length})`} />
        <ResponsiveTable
          rowKey={(b) => b.id}
          rows={bookings}
          emptyMessage="ไม่มีการจองในช่วงเวลาที่เลือก"
          columns={[
            { key: "datetime", header: "วันเวลา", cell: (b) => DATE_TIME_FORMAT.format(b.startTime), emphasize: true },
            { key: "customer", header: "ลูกค้า", cell: (b) => b.customer?.name ?? b.channelCustomer?.name ?? b.guestName ?? "-" },
            { key: "service", header: "บริการ", cell: (b) => b.serviceOption.service.name },
            { key: "therapist", header: "หมอนวด", cell: (b) => b.therapist?.nickname ?? "-" },
            { key: "status", header: "สถานะ", cell: (b) => BOOKING_STATUS_LABEL[b.status] ?? b.status },
            {
              key: "channel",
              header: "ช่องทาง",
              cell: (b) => {
                const key = resolveChannelKey(b);
                return <Badge variant={CHANNEL_BADGE_VARIANT[key]}>{CHANNEL_LABEL[key]}</Badge>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
