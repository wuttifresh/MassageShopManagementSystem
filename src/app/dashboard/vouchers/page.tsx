import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { PageHeader } from "@/components/ui/page-header";
import { ListRow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function VouchersPage() {
  await requireOwnerPage("/dashboard/vouchers");

  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="รหัสส่วนลด (Voucher)"
        description="โค้ดโปรโมชั่นที่ใช้ซ้ำได้หลายครั้ง สำหรับใส่ตอนรับชำระเงินที่ POS"
        actions={<LinkButton href="/dashboard/vouchers/new">+ เพิ่มรหัสส่วนลด</LinkButton>}
      />

      <div className="flex flex-col gap-2.5">
        {vouchers.length === 0 && <EmptyState icon="🏷️" title="ยังไม่มีรหัสส่วนลด" />}
        {vouchers.map((v) => {
          const expired = v.expiresAt !== null && v.expiresAt < now;
          const exhausted = v.maxRedemptions !== null && v.redemptionCount >= v.maxRedemptions;
          const usable = v.isActive && !expired && !exhausted;

          return (
            <Link key={v.id} href={`/dashboard/vouchers/${v.id}`}>
              <ListRow>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{v.code}</p>
                  <p className="truncate text-text-secondary">
                    {v.discountType === "PERCENTAGE" ? `ลด ${v.discountValue}%` : `ลด ฿${v.discountValue}`} · ใช้แล้ว{" "}
                    {v.redemptionCount}
                    {v.maxRedemptions !== null ? `/${v.maxRedemptions}` : ""} ครั้ง
                    {v.expiresAt && ` · หมดอายุ ${v.expiresAt.toLocaleDateString("th-TH")}`}
                  </p>
                </div>
                <Badge variant={usable ? "success" : "neutral"}>
                  {!v.isActive ? "ปิดใช้งาน" : expired ? "หมดอายุ" : exhausted ? "ใช้ครบแล้ว" : "ใช้งานได้"}
                </Badge>
              </ListRow>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
