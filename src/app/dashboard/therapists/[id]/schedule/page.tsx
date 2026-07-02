import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { ScheduleEditor } from "./schedule-editor";
import { PageHeader } from "@/components/ui/page-header";

const DAY_COUNT = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDays(count: number): Date[] {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Array.from({ length: count }, (_, i) => new Date(base.getTime() + i * 86_400_000));
}

export default async function TherapistSchedulePage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect(`/login?callbackUrl=/dashboard/therapists/${params.id}/schedule`);
  }

  const therapist = await prisma.therapist.findUnique({ where: { id: params.id } });
  if (!therapist || therapist.deletedAt) notFound();
  if (session.user.role === "STAFF" && session.user.branchId !== therapist.branchId) notFound();

  const days = nextDays(DAY_COUNT);
  const schedules = await prisma.therapistSchedule.findMany({
    where: { therapistId: therapist.id, date: { gte: days[0], lte: days[days.length - 1] } },
  });
  const schedulesByDate = new Map(schedules.map((s) => [isoDate(s.date), s]));

  const initialDays = days.map((d) => {
    const iso = isoDate(d);
    const existing = schedulesByDate.get(iso);
    return {
      date: iso,
      status: existing?.status ?? "WORKING",
      startTime: existing?.startTime ?? "10:00",
      endTime: existing?.endTime ?? "20:00",
    };
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref={`/dashboard/therapists/${therapist.id}`} title={`ตารางเวร: ${therapist.nickname}`} />
      <ScheduleEditor therapistId={therapist.id} initialDays={initialDays} />
    </div>
  );
}
