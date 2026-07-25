import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { EditVoucherForm } from "./edit-voucher-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function EditVoucherPage({ params }: { params: { id: string } }) {
  await requireOwnerPage(`/dashboard/vouchers/${params.id}`);

  const voucher = await prisma.voucher.findUnique({ where: { id: params.id } });
  if (!voucher) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/vouchers" title={`แก้ไขรหัสส่วนลด: ${voucher.code}`} />
      <Card>
        <EditVoucherForm
          voucherId={voucher.id}
          initial={{
            discountType: voucher.discountType,
            discountValue: voucher.discountValue.toString(),
            maxRedemptions: voucher.maxRedemptions !== null ? String(voucher.maxRedemptions) : "",
            expiresAt: voucher.expiresAt ? voucher.expiresAt.toISOString().slice(0, 10) : "",
            isActive: voucher.isActive,
          }}
          redemptionCount={voucher.redemptionCount}
        />
      </Card>
    </div>
  );
}
