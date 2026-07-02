import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { PageHeader } from "@/components/ui/page-header";
import { ListRow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function StaffPage() {
  await requireOwnerPage("/dashboard/staff");

  const staff = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "STAFF"] }, deletedAt: null },
    include: { branch: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="พนักงาน"
        description="รายชื่อเจ้าของร้านและพนักงานทั้งหมด"
        actions={<LinkButton href="/dashboard/staff/new">+ เพิ่มพนักงาน</LinkButton>}
      />

      <div className="flex flex-col gap-2.5">
        {staff.length === 0 && <EmptyState icon="🧑‍💼" title="ยังไม่มีพนักงาน" />}
        {staff.map((s) => (
          <ListRow key={s.id} interactive={false}>
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">
                {s.name} <span className="text-gray-400">({s.role})</span>
              </p>
              <p className="truncate text-text-secondary">
                {s.email} · {s.branch?.name ?? "ทุกสาขา"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={s.isActive ? "success" : "neutral"}>{s.isActive ? "ใช้งานได้" : "ปิดใช้งาน"}</Badge>
              {s.role === "STAFF" && (
                <Link
                  href={`/dashboard/staff/${s.id}`}
                  className="text-sm font-medium text-primary hover:text-primary-hover hover:underline"
                >
                  แก้ไข
                </Link>
              )}
            </div>
          </ListRow>
        ))}
      </div>
    </div>
  );
}
