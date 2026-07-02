import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { SellPackageForm } from "./sell-package-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function NewPackagePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { branchId?: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect(`/login?callbackUrl=/dashboard/customers/${params.id}/packages/new`);
  }

  const customer = await prisma.user.findUnique({ where: { id: params.id, role: "CUSTOMER" } });
  if (!customer || customer.deletedAt) notFound();

  const branchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  if (!branchId) redirect(`/dashboard/customers/${params.id}`);

  const services = await prisma.service.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref={`/dashboard/customers/${customer.id}`} title={`ขายคอร์สให้ ${customer.name}`} />
      <Card>
        <SellPackageForm customerId={customer.id} branchId={branchId} services={services} />
      </Card>
    </div>
  );
}
