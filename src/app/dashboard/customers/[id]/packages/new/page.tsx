import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { SellPackageForm } from "./sell-package-form";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href={`/dashboard/customers/${customer.id}`} className="text-sm text-neutral-400">
        ← กลับ
      </Link>
      <h1 className="text-xl font-semibold">ขายคอร์สให้ {customer.name}</h1>
      <SellPackageForm customerId={customer.id} branchId={branchId} services={services} />
    </main>
  );
}
