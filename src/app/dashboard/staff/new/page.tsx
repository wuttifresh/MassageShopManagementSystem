import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { NewStaffForm } from "./new-staff-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function NewStaffPage() {
  await requireOwnerPage("/dashboard/staff/new");

  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/staff" title="เพิ่มพนักงาน" />
      <Card>
        <NewStaffForm branches={branches} />
      </Card>
    </div>
  );
}
