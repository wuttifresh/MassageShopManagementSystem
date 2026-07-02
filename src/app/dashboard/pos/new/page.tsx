import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { Checkout, type PrefillLineItem } from "./checkout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: { branchId?: string; queueId?: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/pos/new");
  }

  let queueId: string | undefined;
  let prefillItem: PrefillLineItem | undefined;
  let branchId: string | null;
  let customerPackages: { id: string; name: string; serviceId: string | null; remainingSessions: number }[] = [];

  if (searchParams.queueId) {
    const queue = await prisma.queue.findUnique({
      where: { id: searchParams.queueId },
      include: { serviceOption: { include: { service: true } }, therapist: true, transaction: true },
    });
    if (!queue || queue.deletedAt) notFound();
    if (queue.transaction) redirect(`/dashboard/pos/receipt/${queue.transaction.id}`);
    if (session.user.role === "STAFF" && session.user.branchId !== queue.branchId) notFound();

    queueId = queue.id;
    branchId = queue.branchId;
    prefillItem = {
      serviceOptionId: queue.serviceOptionId,
      serviceName: queue.serviceOption.service.name,
      durationMinutes: queue.serviceOption.durationMinutes,
      price: queue.serviceOption.price.toString(),
      promoPrice: queue.serviceOption.promoPrice?.toString() ?? null,
      therapistId: queue.therapistId,
      therapistNickname: queue.therapist?.nickname ?? null,
    };

    if (queue.customerId) {
      const packages = await prisma.package.findMany({
        where: {
          customerId: queue.customerId,
          status: "ACTIVE",
          remainingSessions: { gt: 0 },
          deletedAt: null,
        },
      });
      customerPackages = packages.map((p) => ({
        id: p.id,
        name: p.name,
        serviceId: p.serviceId,
        remainingSessions: p.remainingSessions,
      }));
    }
  } else {
    branchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  }

  if (!branchId) {
    return <EmptyState icon="🏢" title="ยังไม่มีสาขาที่ใช้งานอยู่" className="mt-10" />;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <PageHeader backHref="/dashboard/pos" title="ขายใหม่" />
      <Card>
        <Checkout
          branchId={branchId}
          queueId={queueId}
          prefillItem={prefillItem}
          customerPackages={customerPackages}
        />
      </Card>
    </div>
  );
}
