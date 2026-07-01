import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { BranchSwitcher } from "@/app/dashboard/branch-switcher";
import { VoidTransactionButton } from "./void-transaction-button";

const STATUS_LABEL: Record<string, string> = {
  PAID: "ชำระแล้ว",
  VOIDED: "ยกเลิกแล้ว",
  REFUNDED: "คืนเงินแล้ว",
  PENDING: "รอชำระ",
};

export default async function PosPage({ searchParams }: { searchParams: { branchId?: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/pos");
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  if (!activeBranchId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
        <p>ยังไม่มีสาขาที่ใช้งานอยู่</p>
      </main>
    );
  }

  const [unpaidQueues, recentTransactions] = await Promise.all([
    prisma.queue.findMany({
      where: { branchId: activeBranchId, status: "DONE", deletedAt: null, transaction: null },
      include: { serviceOption: { include: { service: true } }, therapist: true, customer: true },
      orderBy: { completedAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: { branchId: activeBranchId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-400">
            ← กลับแดชบอร์ด
          </Link>
          <h1 className="text-xl font-semibold">POS / ชำระเงิน</h1>
        </div>
        <Link
          href="/dashboard/pos/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          + ขายใหม่
        </Link>
      </div>

      {session.user.role === "OWNER" && (
        <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">รอชำระเงิน ({unpaidQueues.length})</h2>
        {unpaidQueues.length === 0 && <p className="text-sm text-neutral-400">ไม่มีคิวที่รอชำระเงิน</p>}
        {unpaidQueues.map((q) => (
          <Link
            key={q.id}
            href={`/dashboard/pos/new?queueId=${q.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm hover:border-neutral-900"
          >
            <div>
              <p className="font-medium">
                {q.queueNumber} · {q.customer?.name ?? q.guestName ?? "ลูกค้า"}
              </p>
              <p className="text-neutral-500">
                {q.serviceOption.service.name} ({q.serviceOption.durationMinutes} นาที) · หมอนวด{" "}
                {q.therapist?.nickname ?? "-"}
              </p>
            </div>
            <span className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white">
              ชำระเงิน
            </span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">รายการล่าสุด</h2>
        {recentTransactions.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm"
          >
            <Link href={`/dashboard/pos/receipt/${t.id}`} className="flex-1">
              <p className="font-medium">
                {t.receiptNo} · ฿{t.totalAmount.toString()}
              </p>
              <p className="text-neutral-500">
                {t.paymentMethod} · {STATUS_LABEL[t.status] ?? t.status}
              </p>
            </Link>
            {t.status === "PAID" && <VoidTransactionButton transactionId={t.id} />}
          </div>
        ))}
      </section>
    </main>
  );
}
