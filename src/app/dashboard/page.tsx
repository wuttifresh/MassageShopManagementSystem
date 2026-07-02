import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { endOfToday, isTherapistBusy, startOfToday } from "@/lib/queue";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { QueueRealtimeListener } from "./queue-realtime-listener";
import { CheckInButton } from "./check-in-button";
import { WalkInForm } from "./walk-in-form";
import { QueueItemCard } from "./queue-item-card";
import { BranchSwitcher } from "./branch-switcher";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { branchId?: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  const locale = getLocale();
  const dict = getDictionary(locale);

  if (!activeBranchId) {
    return (
      <EmptyState
        icon="🏢"
        title={dict.dashboard.noBranch}
        description={dict.dashboard.noBranchHint}
        className="mt-10"
      />
    );
  }

  const [checkInCandidates, queues, therapists] = await Promise.all([
    prisma.booking.findMany({
      where: {
        branchId: activeBranchId,
        deletedAt: null,
        status: { in: ["CONFIRMED", "PENDING"] },
        startTime: { gte: startOfToday(), lt: endOfToday() },
        queue: null,
      },
      include: { serviceOption: { include: { service: true } }, therapist: true, customer: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.queue.findMany({
      where: {
        branchId: activeBranchId,
        deletedAt: null,
        createdAt: { gte: startOfToday(), lt: endOfToday() },
      },
      include: { serviceOption: { include: { service: true } }, therapist: true, customer: true },
      orderBy: [{ status: "asc" }, { checkedInAt: "asc" }],
    }),
    prisma.therapist.findMany({
      where: { branchId: activeBranchId, status: "ACTIVE", deletedAt: null },
      orderBy: { nickname: "asc" },
    }),
  ]);

  const busyMap = new Map(
    await Promise.all(therapists.map(async (t) => [t.id, await isTherapistBusy(t.id)] as const))
  );

  const therapistOptions = therapists.map((t) => ({
    id: t.id,
    nickname: t.nickname,
    busy: busyMap.get(t.id) ?? false,
  }));

  return (
    <div className="flex flex-col gap-5">
      <QueueRealtimeListener branchId={activeBranchId} />

      <PageHeader
        title={dict.dashboard.title}
        description={dict.dashboard.description}
        actions={
          session.user.role === "OWNER" ? (
            <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader
              title={dict.dashboard.waitingCheckIn}
              action={<Badge variant="warning">{checkInCandidates.length}</Badge>}
            />
            {checkInCandidates.length === 0 ? (
              <EmptyState icon="🗓️" title={dict.dashboard.noWaitingCheckIn} />
            ) : (
              <div className="flex flex-col gap-2.5">
                {checkInCandidates.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {booking.customer?.name ?? booking.guestName ?? dict.common.customerFallback} ·{" "}
                        {booking.serviceOption.service.name}
                      </p>
                      <p className="text-text-secondary">
                        {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "UTC",
                        }).format(booking.startTime)}
                        {dict.dashboard.timeSuffix} · {dict.dashboard.therapistPrefix}{" "}
                        {booking.therapist?.nickname ?? dict.dashboard.anyTherapist}
                      </p>
                    </div>
                    <CheckInButton
                      bookingId={booking.id}
                      therapistOptions={therapistOptions}
                      initialTherapistId={booking.therapistId}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={dict.dashboard.todayQueue} action={<Badge variant="info">{queues.length}</Badge>} />
            {queues.length === 0 ? (
              <EmptyState icon="🛌" title={dict.dashboard.noTodayQueue} />
            ) : (
              <div className="flex flex-col gap-2.5">
                {queues.map((queue) => (
                  <QueueItemCard key={queue.id} queue={queue} therapistOptions={therapistOptions} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-20">
            <CardHeader title={dict.dashboard.addWalkIn} />
            <WalkInForm branchId={activeBranchId} />
          </Card>
        </div>
      </div>
    </div>
  );
}
