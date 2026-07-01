import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { Checkout, type PrefillLineItem } from "./checkout";

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
  } else {
    branchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  }

  if (!branchId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
        <p>ยังไม่มีสาขาที่ใช้งานอยู่</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href="/dashboard/pos" className="text-sm text-neutral-400">
        ← กลับ
      </Link>
      <h1 className="text-xl font-semibold">ขายใหม่</h1>
      <Checkout branchId={branchId} queueId={queueId} prefillItem={prefillItem} />
    </main>
  );
}
