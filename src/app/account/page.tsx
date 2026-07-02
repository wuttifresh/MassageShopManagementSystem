import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import { CancelBookingButton } from "./cancel-booking-button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาตามนัด",
  COMPLETED: "เสร็จสิ้น",
  RESCHEDULED: "เลื่อนนัดแล้ว",
};

const BOOKING_STATUS_BADGE: Record<string, BadgeVariant> = {
  PENDING: "warning",
  CONFIRMED: "info",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  COMPLETED: "success",
  RESCHEDULED: "info",
};

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

const PACKAGE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "ใช้งานได้",
  EXPIRED: "หมดอายุ",
  FULLY_USED: "ใช้ครบแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

const PACKAGE_STATUS_BADGE: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  FULLY_USED: "neutral",
  CANCELLED: "danger",
};

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const TIME_FORMAT = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function AccountPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== "CUSTOMER") redirect("/login?callbackUrl=/account");

  const [bookings, membership, packages] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: session.user.id, deletedAt: null },
      include: {
        serviceOption: { include: { service: true } },
        therapist: true,
        queue: true,
      },
      orderBy: { startTime: "desc" },
      take: 20,
    }),
    prisma.membership.findUnique({ where: { customerId: session.user.id } }),
    prisma.package.findMany({
      where: { customerId: session.user.id, deletedAt: null },
      include: { service: true },
      orderBy: { purchasedAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">บัญชีของฉัน</h1>
          <p className="truncate text-sm text-text-secondary">สวัสดี {session.user.name}</p>
          {membership && (
            <p className="text-sm text-text-secondary">
              สมาชิก {membership.tier} · {membership.points} แต้ม
            </p>
          )}
        </div>
        <SignOutButton className="shrink-0" />
      </header>

      {packages.length > 0 && (
        <Card>
          <CardHeader title="คอร์สของฉัน" />
          <div className="flex flex-col gap-2.5">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{pkg.name}</p>
                  <p className="text-sm text-text-secondary">
                    เหลือ {pkg.remainingSessions}/{pkg.totalSessions} ครั้ง
                    {pkg.service ? ` · ${pkg.service.name}` : " · ใช้ได้ทุกบริการ"}
                  </p>
                </div>
                <Badge variant={PACKAGE_STATUS_BADGE[pkg.status] ?? "neutral"}>
                  {PACKAGE_STATUS_LABEL[pkg.status] ?? pkg.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LinkButton href="/book" size="lg" fullWidth>
        + จองคิวใหม่
      </LinkButton>

      <Card>
        <CardHeader title="การจองของฉัน" />

        {bookings.length === 0 ? (
          <EmptyState icon="🗓️" title="ยังไม่มีการจอง" description="ลองกดจองคิวใหม่ดูสิ" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {bookings.map((booking) => (
              <div key={booking.id} className="flex flex-col gap-2 rounded-xl border border-border p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{booking.serviceOption.service.name}</span>
                  <Badge variant={BOOKING_STATUS_BADGE[booking.status] ?? "neutral"}>
                    {STATUS_LABEL[booking.status] ?? booking.status}
                  </Badge>
                </div>
                <p className="text-sm text-text-secondary">
                  {DATE_FORMAT.format(booking.startTime)} · {TIME_FORMAT.format(booking.startTime)} น. (
                  {booking.serviceOption.durationMinutes} นาที)
                </p>
                <p className="text-sm text-text-secondary">
                  หมอนวด: {booking.therapist?.nickname ?? "ยังไม่ระบุ"}
                </p>

                {booking.queue && (
                  <p className="text-sm text-text-secondary">
                    สถานะคิว: {booking.queue.status === "WAITING" ? "รอคิว" : booking.queue.status}
                    {booking.queue.queueNumber ? ` (คิวที่ ${booking.queue.queueNumber})` : ""}
                  </p>
                )}

                {ACTIVE_STATUSES.includes(booking.status) && (
                  <div className="flex gap-2 pt-1">
                    <LinkButton href={`/account/bookings/${booking.id}/reschedule`} variant="outline" className="flex-1">
                      เลื่อนนัด
                    </LinkButton>
                    <CancelBookingButton bookingId={booking.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
