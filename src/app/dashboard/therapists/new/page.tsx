import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { NewTherapistForm } from "./new-therapist-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function NewTherapistPage({
  searchParams,
}: {
  searchParams: { branchId?: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/therapists/new");
  }

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  if (!activeBranchId) redirect("/dashboard/therapists");

  const services = await prisma.service.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/therapists" title="เพิ่มหมอนวด" />
      <Card>
        <NewTherapistForm branchId={activeBranchId} services={services} />
      </Card>
    </div>
  );
}
