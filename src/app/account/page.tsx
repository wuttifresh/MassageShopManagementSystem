import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import { CancelBookingButton } from "./cancel-booking-button";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาตามนัด",
  COMPLETED: "เสร็จสิ้น",
  RESCHEDULED: "เลื่อนนัดแล้ว",
};

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

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

  const bookings = await prisma.booking.findMany({
    where: { customerId: session.user.id, deletedAt: null },
    include: {
      serviceOption: { include: { service: true } },
      therapist: true,
      queue: true,
    },
    orderBy: { startTime: "desc" },
    take: 20,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">บัญชีของฉัน</h1>
          <p className="text-sm text-neutral-500">สวัสดี {session.user.name}</p>
        </div>
        <SignOutButton />
      </header>

      <Link
        href="/book"
        className="rounded-lg bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white"
      >
        + จองคิวใหม่
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-500">การจองของฉัน</h2>

        {bookings.length === 0 && (
          <p className="text-sm text-neutral-400">ยังไม่มีการจอง ลองกดจองคิวใหม่ดูสิ</p>
        )}

        {bookings.map((booking) => (
          <div key={booking.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{booking.serviceOption.service.name}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                {STATUS_LABEL[booking.status] ?? booking.status}
              </span>
            </div>
            <p className="text-sm text-neutral-500">
              {DATE_FORMAT.format(booking.startTime)} · {TIME_FORMAT.format(booking.startTime)} น. (
              {booking.serviceOption.durationMinutes} นาที)
            </p>
            <p className="text-sm text-neutral-500">
              หมอนวด: {booking.therapist?.nickname ?? "ยังไม่ระบุ"}
            </p>

            {booking.queue && (
              <p className="text-sm text-neutral-500">
                สถานะคิว: {booking.queue.status === "WAITING" ? "รอคิว" : booking.queue.status}
                {booking.queue.queueNumber ? ` (คิวที่ ${booking.queue.queueNumber})` : ""}
              </p>
            )}

            {ACTIVE_STATUSES.includes(booking.status) && (
              <div className="flex gap-2 pt-1">
                <Link
                  href={`/account/bookings/${booking.id}/reschedule`}
                  className="flex-1 rounded-lg border border-neutral-300 py-2 text-center text-sm"
                >
                  เลื่อนนัด
                </Link>
                <CancelBookingButton bookingId={booking.id} />
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
