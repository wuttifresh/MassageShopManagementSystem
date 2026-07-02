import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { PageHeader } from "@/components/ui/page-header";
import { ListRow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function BranchesPage() {
  await requireOwnerPage("/dashboard/branches");

  const branches = await prisma.branch.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="จัดการสาขา"
        description="รายชื่อสาขาทั้งหมดในระบบ"
        actions={<LinkButton href="/dashboard/branches/new">+ เพิ่มสาขา</LinkButton>}
      />

      <div className="flex flex-col gap-2.5">
        {branches.length === 0 && <EmptyState icon="🏢" title="ยังไม่มีสาขา" />}
        {branches.map((b) => (
          <Link key={b.id} href={`/dashboard/branches/${b.id}`}>
            <ListRow>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{b.name}</p>
                <p className="truncate text-text-secondary">
                  {b.address ?? "ไม่มีที่อยู่"} · {b.openTime}-{b.closeTime}
                </p>
              </div>
              <Badge variant={b.isActive ? "success" : "neutral"}>{b.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge>
            </ListRow>
          </Link>
        ))}
      </div>
    </div>
  );
}
