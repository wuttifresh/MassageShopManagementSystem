import { requireOwnerPage } from "@/lib/require-owner-page";
import { NewBranchForm } from "./new-branch-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function NewBranchPage() {
  await requireOwnerPage("/dashboard/branches/new");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/branches" title="เพิ่มสาขา" />
      <Card>
        <NewBranchForm />
      </Card>
    </div>
  );
}
