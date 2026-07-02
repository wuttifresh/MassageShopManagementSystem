import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { ReschedulePicker } from "./reschedule-picker";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";

export default async function ReschedulePage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== "CUSTOMER") {
    redirect(`/login?callbackUrl=/account/bookings/${params.id}/reschedule`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { serviceOption: { include: { service: true } }, therapist: true, branch: true },
  });

  if (!booking || booking.customerId !== session.user.id || booking.deletedAt) notFound();
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") notFound();

  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{dict.reschedule.title}</h1>
        <LanguageSwitcher />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
        <p className="font-medium text-gray-900">{booking.serviceOption.service.name}</p>
        <p className="text-text-secondary">
          {booking.serviceOption.durationMinutes} {dict.dashboard.minutesSuffix} · {dict.dashboard.therapistPrefix}{" "}
          {booking.therapist?.nickname ?? dict.dashboard.anyTherapist}
        </p>
      </div>

      <ReschedulePicker
        bookingId={booking.id}
        branchId={booking.branchId}
        serviceId={booking.serviceOption.serviceId}
        durationMinutes={booking.serviceOption.durationMinutes}
        therapistId={booking.therapistId}
      />
    </main>
  );
}
