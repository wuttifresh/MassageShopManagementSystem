import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { EditStaffForm } from "./edit-staff-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function EditStaffPage({ params }: { params: { id: string } }) {
  await requireOwnerPage(`/dashboard/staff/${params.id}`);

  const staffMember = await prisma.user.findUnique({ where: { id: params.id } });
  if (!staffMember || staffMember.role !== "STAFF" || staffMember.deletedAt) notFound();

  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/staff" title={`แก้ไข ${staffMember.name}`} />
      <Card>
        <EditStaffForm
          userId={staffMember.id}
          branches={branches}
          initial={{ branchId: staffMember.branchId ?? branches[0]?.id ?? "", isActive: staffMember.isActive }}
        />
      </Card>
    </div>
  );
}
