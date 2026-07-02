import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { endOfToday, isTherapistBusy, startOfToday } from "@/lib/queue";
import { resolveActiveBranchId } from "@/lib/branch-scope";
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

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);

  if (!activeBranchId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-3xl">🏢</p>
        <p className="text-neutral-600">ยังไม่มีสาขาที่ใช้งานอยู่ กรุณาติดต่อผู้ดูแลระบบ</p>
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <QueueRealtimeListener branchId={activeBranchId} />

      <header className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">แดชบอร์ดคิว</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
            {session.user.name}
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
              {session.user.role === "OWNER" ? "เจ้าของร้าน" : "พนักงาน"}
            </span>
          </p>
        </div>
        <SignOutButton />
      </header>

      <nav className="flex flex-wrap gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-100 text-sm">
        <Link
          href="/dashboard/pos"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
        >
          POS / ชำระเงิน
        </Link>
        <Link
          href="/dashboard/customers"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
        >
          ลูกค้า
        </Link>
        <Link
          href="/dashboard/therapists"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
        >
          จัดการหมอนวด
        </Link>
        <Link
          href="/dashboard/services"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
        >
          จัดการบริการ
        </Link>
        <Link
          href="/dashboard/reports"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
        >
          รายงาน
        </Link>
        {session.user.role === "OWNER" && (
          <>
            <Link
              href="/dashboard/branches"
              className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
            >
              จัดการสาขา
            </Link>
            <Link
              href="/dashboard/staff"
              className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
            >
              พนักงาน
            </Link>
          </>
        )}
      </nav>

      {session.user.role === "OWNER" && (
        <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-100">
          <span className="shrink-0 text-sm font-medium text-neutral-500">สาขา:</span>
          <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          รอเช็คอิน
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {checkInCandidates.length}
          </span>
        </h2>
        {checkInCandidates.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-200 py-4 text-center text-sm text-neutral-400">
            ไม่มีการจองที่รอเช็คอินวันนี้
          </p>
        )}
        {checkInCandidates.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm transition hover:border-neutral-300"
          >
            <div>
              <p className="font-medium text-neutral-900">
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

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-700">เพิ่มคิว walk-in</h2>
        <WalkInForm branchId={activeBranchId} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          คิววันนี้
          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
            {queues.length}
          </span>
        </h2>
        {queues.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-200 py-4 text-center text-sm text-neutral-400">
            ยังไม่มีคิววันนี้
          </p>
        )}
        {queues.map((queue) => (
          <QueueItemCard key={queue.id} queue={queue} therapistOptions={therapistOptions} />
        ))}
      </section>
    </main>
  );
}
