import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { ReschedulePicker } from "./reschedule-picker";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-gray-900">เลื่อนนัด</h1>
      <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
        <p className="font-medium text-gray-900">{booking.serviceOption.service.name}</p>
        <p className="text-text-secondary">
          {booking.serviceOption.durationMinutes} นาที · หมอนวด{" "}
          {booking.therapist?.nickname ?? "คนไหนก็ได้"}
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
