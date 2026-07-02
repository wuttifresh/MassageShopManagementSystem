import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { EditBranchForm } from "./edit-branch-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function EditBranchPage({ params }: { params: { id: string } }) {
  await requireOwnerPage(`/dashboard/branches/${params.id}`);

  const branch = await prisma.branch.findUnique({ where: { id: params.id } });
  if (!branch || branch.deletedAt) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/branches" title="แก้ไขสาขา" />
      <Card>
        <EditBranchForm
          branchId={branch.id}
          initial={{
            name: branch.name,
            slug: branch.slug,
            address: branch.address ?? "",
            phone: branch.phone ?? "",
            openTime: branch.openTime,
            closeTime: branch.closeTime,
            isActive: branch.isActive,
          }}
        />
      </Card>
    </div>
  );
}
