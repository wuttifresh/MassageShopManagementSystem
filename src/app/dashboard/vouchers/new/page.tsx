import { requireOwnerPage } from "@/lib/require-owner-page";
import { NewVoucherForm } from "./new-voucher-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function NewVoucherPage() {
  await requireOwnerPage("/dashboard/vouchers/new");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/vouchers" title="เพิ่มรหัสส่วนลด" />
      <Card>
        <NewVoucherForm />
      </Card>
    </div>
  );
}
