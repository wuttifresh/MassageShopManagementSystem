import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import { CancelBookingButton } from "./cancel-booking-button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";

const BOOKING_STATUS_BADGE: Record<string, BadgeVariant> = {
  PENDING: "warning",
  CONFIRMED: "info",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  COMPLETED: "success",
  RESCHEDULED: "info",
};

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

const PACKAGE_STATUS_BADGE: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  FULLY_USED: "neutral",
  CANCELLED: "danger",
};

export default async function AccountPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== "CUSTOMER") redirect("/login?callbackUrl=/account");

  const locale = getLocale();
  const dict = getDictionary(locale);
  const intlLocale = locale === "th" ? "th-TH" : "en-US";
  const dateFormat = new Intl.DateTimeFormat(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const timeFormat = new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

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
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{dict.account.title}</h1>
          <p className="truncate text-sm text-text-secondary">
            {dict.account.greeting} {session.user.name}
          </p>
          {membership && (
            <p className="text-sm text-text-secondary">
              {dict.account.member} {membership.tier} · {membership.points} {dict.account.points}
            </p>
          )}
        </div>
        <SignOutButton className="shrink-0" />
      </header>

      {packages.length > 0 && (
        <Card>
          <CardHeader title={dict.account.myPackages} />
          <div className="flex flex-col gap-2.5">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{pkg.name}</p>
                  <p className="text-sm text-text-secondary">
                    {dict.account.remainingOf} {pkg.remainingSessions}/{pkg.totalSessions} {dict.account.sessionsUnit}
                    {pkg.service ? ` · ${pkg.service.name}` : ` · ${dict.account.anyService}`}
                  </p>
                </div>
                <Badge variant={PACKAGE_STATUS_BADGE[pkg.status] ?? "neutral"}>
                  {dict.packageStatus[pkg.status as keyof typeof dict.packageStatus] ?? pkg.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LinkButton href="/book" size="lg" fullWidth>
        {dict.account.bookNew}
      </LinkButton>

      <Card>
        <CardHeader title={dict.account.myBookings} />

        {bookings.length === 0 ? (
          <EmptyState icon="🗓️" title={dict.account.noBookings} description={dict.account.noBookingsHint} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {bookings.map((booking) => (
              <div key={booking.id} className="flex flex-col gap-2 rounded-xl border border-border p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{booking.serviceOption.service.name}</span>
                  <Badge variant={BOOKING_STATUS_BADGE[booking.status] ?? "neutral"}>
                    {dict.bookingStatus[booking.status as keyof typeof dict.bookingStatus] ?? booking.status}
                  </Badge>
                </div>
                <p className="text-sm text-text-secondary">
                  {dateFormat.format(booking.startTime)} · {timeFormat.format(booking.startTime)}
                  {dict.dashboard.timeSuffix} ({booking.serviceOption.durationMinutes} {dict.dashboard.minutesSuffix})
                </p>
                <p className="text-sm text-text-secondary">
                  {dict.dashboard.therapistPrefix}: {booking.therapist?.nickname ?? dict.account.therapistNotSet}
                </p>

                {booking.queue && (
                  <p className="text-sm text-text-secondary">
                    {dict.account.queueStatusPrefix}:{" "}
                    {booking.queue.status === "WAITING"
                      ? dict.account.waitingQueue
                      : dict.queueStatus[booking.queue.status as keyof typeof dict.queueStatus] ?? booking.queue.status}
                    {booking.queue.queueNumber ? ` (${dict.account.queueNumberPrefix} ${booking.queue.queueNumber})` : ""}
                  </p>
                )}

                {ACTIVE_STATUSES.includes(booking.status) && (
                  <div className="flex gap-2 pt-1">
                    <LinkButton href={`/account/bookings/${booking.id}/reschedule`} variant="outline" className="flex-1">
                      {dict.account.reschedule}
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
