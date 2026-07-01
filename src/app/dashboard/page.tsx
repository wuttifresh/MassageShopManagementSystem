import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { endOfToday, isTherapistBusy, startOfToday } from "@/lib/queue";
import { SignOutButton } from "@/components/sign-out-button";
import { QueueRealtimeListener } from "./queue-realtime-listener";
import { CheckInButton } from "./check-in-button";
import { WalkInForm } from "./walk-in-form";
import { QueueItemCard } from "./queue-item-card";
import { BranchSwitcher } from "./branch-switcher";

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

  const activeBranchId =
    session.user.role === "STAFF"
      ? session.user.branchId
      : (searchParams.branchId ?? branches[0]?.id ?? null);

  if (!activeBranchId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
        <p>ยังไม่มีสาขาที่ใช้งานอยู่ กรุณาติดต่อผู้ดูแลระบบ</p>
      </main>
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4">
      <QueueRealtimeListener branchId={activeBranchId} />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">แดชบอร์ดคิว</h1>
          <p className="text-sm text-neutral-500">
            {session.user.name} ({session.user.role})
          </p>
        </div>
        <SignOutButton />
      </header>

      {session.user.role === "OWNER" && (
        <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-500">
          รอเช็คอิน ({checkInCandidates.length})
        </h2>
        {checkInCandidates.length === 0 && (
          <p className="text-sm text-neutral-400">ไม่มีการจองที่รอเช็คอินวันนี้</p>
        )}
        {checkInCandidates.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {booking.customer?.name ?? booking.guestName ?? "ลูกค้า"} ·{" "}
                {booking.serviceOption.service.name}
              </p>
              <p className="text-neutral-500">
                {new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(
                  booking.startTime
                )}{" "}
                น. · หมอนวด {booking.therapist?.nickname ?? "คนไหนก็ได้"}
              </p>
            </div>
            <CheckInButton bookingId={booking.id} />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-500">เพิ่มคิว walk-in</h2>
        <WalkInForm branchId={activeBranchId} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-500">คิววันนี้ ({queues.length})</h2>
        {queues.length === 0 && <p className="text-sm text-neutral-400">ยังไม่มีคิววันนี้</p>}
        {queues.map((queue) => (
          <QueueItemCard key={queue.id} queue={queue} therapistOptions={therapistOptions} />
        ))}
      </section>
    </main>
  );
}
