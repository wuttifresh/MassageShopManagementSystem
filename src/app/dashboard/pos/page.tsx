import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { BranchSwitcher } from "@/app/dashboard/branch-switcher";
import { VoidTransactionButton } from "./void-transaction-button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, ListRow } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_LABEL: Record<string, string> = {
  PAID: "ชำระแล้ว",
  VOIDED: "ยกเลิกแล้ว",
  REFUNDED: "คืนเงินแล้ว",
  PENDING: "รอชำระ",
};

const STATUS_BADGE: Record<string, BadgeVariant> = {
  PAID: "success",
  VOIDED: "danger",
  REFUNDED: "warning",
  PENDING: "neutral",
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
    return <EmptyState icon="🏢" title="ยังไม่มีสาขาที่ใช้งานอยู่" className="mt-10" />;
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="POS / ชำระเงิน"
        description="รับชำระเงินและดูรายการขายล่าสุด"
        actions={<LinkButton href="/dashboard/pos/new">+ ขายใหม่</LinkButton>}
      />

      {session.user.role === "OWNER" && <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />}

      <Card>
        <CardHeader title="รอชำระเงิน" action={<Badge variant="warning">{unpaidQueues.length}</Badge>} />
        {unpaidQueues.length === 0 ? (
          <EmptyState icon="✅" title="ไม่มีคิวที่รอชำระเงิน" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {unpaidQueues.map((q) => (
              <Link key={q.id} href={`/dashboard/pos/new?queueId=${q.id}`}>
                <ListRow>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">
                      {q.queueNumber} · {q.customer?.name ?? q.guestName ?? "ลูกค้า"}
                    </p>
                    <p className="truncate text-text-secondary">
                      {q.serviceOption.service.name} ({q.serviceOption.durationMinutes} นาที) · หมอนวด{" "}
                      {q.therapist?.nickname ?? "-"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">
                    ชำระเงิน
                  </span>
                </ListRow>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="รายการล่าสุด" />
        {recentTransactions.length === 0 ? (
          <EmptyState icon="🧾" title="ยังไม่มีรายการ" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {recentTransactions.map((t) => (
              <ListRow key={t.id} interactive={false}>
                <Link href={`/dashboard/pos/receipt/${t.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">
                    {t.receiptNo} · ฿{t.totalAmount.toString()}
                  </p>
                  <p className="truncate text-text-secondary">
                    {t.paymentMethod} · {STATUS_LABEL[t.status] ?? t.status}
                  </p>
                </Link>
                <Badge variant={STATUS_BADGE[t.status] ?? "neutral"}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                {t.status === "PAID" && <VoidTransactionButton transactionId={t.id} />}
              </ListRow>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
