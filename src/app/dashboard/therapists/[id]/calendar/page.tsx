import { notFound, redirect } from "next/navigation";
import { BookingStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getTherapistSlots } from "@/lib/availability";
import { getAvailabilityFromCore } from "@/lib/booking-core-client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาตามนัด",
  COMPLETED: "เสร็จสิ้น",
  RESCHEDULED: "เลื่อนนัดแล้ว",
};

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const TIME_FORMAT = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return isoDate(new Date());
}

function addDays(iso: string, count: number): string {
  return isoDate(new Date(new Date(iso).getTime() + count * 86_400_000));
}

export default async function TherapistCalendarPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { date?: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect(`/login?callbackUrl=/dashboard/therapists/${params.id}/calendar`);
  }

  const therapist = await prisma.therapist.findUnique({ where: { id: params.id } });
  if (!therapist || therapist.deletedAt) notFound();
  if (session.user.role === "STAFF" && session.user.branchId !== therapist.branchId) notFound();

  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayIso();
  const dayStart = new Date(date);
  const dayEnd = new Date(addDays(date, 1));

  const [schedule, timeBlocks, bookings] = await Promise.all([
    prisma.therapistSchedule.findUnique({
      where: { therapistId_date: { therapistId: therapist.id, date: dayStart } },
    }),
    prisma.therapistTimeBlock.findMany({
      where: { therapistId: therapist.id, date: dayStart },
      orderBy: { startTime: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        therapistId: therapist.id,
        deletedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      include: { serviceOption: { include: { service: true } }, channelCustomer: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  // Pick one representative service option (any specialty of this therapist, falling back to any
  // active option at the branch) so we can cross-check the Prisma-computed free slots below
  // against the Go booking-core's independently-computed /v1/availability answer for the exact
  // same day — proving the calendar view actually syncs with the Phase 1 engine, not just a copy
  // of its logic.
  const representativeOption = await prisma.serviceOption.findFirst({
    where: {
      isActive: true,
      service: { isActive: true, deletedAt: null, therapistSpecialty: { some: { therapistId: therapist.id } } },
    },
    orderBy: { createdAt: "asc" },
  });

  let localSlots: string[] = [];
  let coreSlots: string[] | null = null;
  let coreError: string | null = null;

  if (representativeOption) {
    const slots = await getTherapistSlots(therapist.id, dayStart, representativeOption.durationMinutes);
    localSlots = slots.map((s) => TIME_FORMAT.format(s));

    try {
      coreSlots = await getAvailabilityFromCore({
        branchId: therapist.branchId,
        serviceOptionId: representativeOption.id,
        therapistId: therapist.id,
        date,
      });
    } catch (err) {
      coreError = err instanceof Error ? err.message : "เรียก booking-core ไม่สำเร็จ";
    }
  }

  const slotsMatch = coreSlots !== null && JSON.stringify([...localSlots].sort()) === JSON.stringify([...coreSlots].sort());

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref={`/dashboard/therapists/${therapist.id}`} title={`ปฏิทิน: ${therapist.nickname}`} />

      <div className="flex items-center justify-between gap-2">
        <LinkButton variant="outline" size="sm" href={`?date=${addDays(date, -1)}`}>
          ← วันก่อนหน้า
        </LinkButton>
        <span className="text-sm font-medium text-gray-900">{DATE_FORMAT.format(dayStart)}</span>
        <LinkButton variant="outline" size="sm" href={`?date=${addDays(date, 1)}`}>
          วันถัดไป →
        </LinkButton>
      </div>

      <Card>
        <CardHeader
          title="เวลาทำงาน"
          description={
            schedule?.status === "WORKING" && schedule.startTime && schedule.endTime
              ? `${schedule.startTime} – ${schedule.endTime}`
              : schedule?.status === "DAY_OFF"
                ? "วันหยุด"
                : schedule?.status === "LEAVE"
                  ? "ลา"
                  : "ยังไม่ได้กำหนดตารางเวร"
          }
        />
      </Card>

      <Card>
        <CardHeader title={`คิวที่จอง (${bookings.length})`} />
        {bookings.length === 0 ? (
          <EmptyState icon="🗓️" title="ยังไม่มีคิวในวันนี้" />
        ) : (
          <ul className="flex flex-col gap-2">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">
                    {TIME_FORMAT.format(b.startTime)} – {TIME_FORMAT.format(b.endTime)}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {b.serviceOption.service.name} · {b.guestName ?? b.channelCustomer?.name ?? "ลูกค้า"}
                  </span>
                </div>
                <Badge variant={b.status === "CONFIRMED" ? "success" : "info"}>
                  {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={`เวลาที่บล็อก (${timeBlocks.length})`} />
        {timeBlocks.length === 0 ? (
          <EmptyState icon="⛔" title="ไม่มีช่วงเวลาที่บล็อกในวันนี้" />
        ) : (
          <ul className="flex flex-col gap-2">
            {timeBlocks.map((block) => (
              <li key={block.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <span className="font-medium text-gray-900">
                  {block.startTime} – {block.endTime}
                </span>
                {block.reason && <span className="ml-2 text-xs text-text-secondary">{block.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="ช่องว่างที่จองได้"
          description={representativeOption ? `อ้างอิงบริการ: ${representativeOption.durationMinutes} นาที` : undefined}
        />
        {!representativeOption ? (
          <EmptyState icon="ℹ️" title="ยังไม่มีบริการที่กำหนดให้หมอนวดคนนี้" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {localSlots.length === 0 ? (
                <span className="text-sm text-text-secondary">ไม่มีช่องว่าง</span>
              ) : (
                localSlots.map((s) => <Badge key={s} variant="neutral">{s}</Badge>)
              )}
            </div>
            <p className="text-xs text-text-secondary">
              {coreError ? (
                <span className="text-danger">ตรวจสอบกับ booking-core ไม่สำเร็จ: {coreError}</span>
              ) : slotsMatch ? (
                <span className="text-success">✓ ตรงกับผลลัพธ์จาก booking-core API (Phase 1) แล้ว</span>
              ) : (
                <span className="text-danger">⚠ ไม่ตรงกับผลลัพธ์จาก booking-core API — โปรดตรวจสอบ</span>
              )}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
