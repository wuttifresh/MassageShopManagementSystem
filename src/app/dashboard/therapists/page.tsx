import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { PageHeader } from "@/components/ui/page-header";
import { ListRow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "พร้อมทำงาน",
  ON_LEAVE: "ลาพัก",
  INACTIVE: "ไม่ทำงานแล้ว",
};

export default async function TherapistsPage({
  searchParams,
}: {
  searchParams: { branchId?: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/therapists");
  }

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  if (!activeBranchId) {
    return <EmptyState icon="🏢" title="ยังไม่มีสาขาที่ใช้งานอยู่" className="mt-10" />;
  }

  const therapists = await prisma.therapist.findMany({
    where: { branchId: activeBranchId, deletedAt: null },
    include: { specialties: { include: { service: true } } },
    orderBy: { nickname: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="จัดการหมอนวด"
        description="ดูและแก้ไขข้อมูลหมอนวดในสาขานี้"
        actions={<LinkButton href="/dashboard/therapists/new">+ เพิ่มหมอนวด</LinkButton>}
      />

      <div className="flex flex-col gap-2.5">
        {therapists.length === 0 && <EmptyState icon="💆" title="ยังไม่มีหมอนวดในสาขานี้" />}
        {therapists.map((t) => (
          <Link key={t.id} href={`/dashboard/therapists/${t.id}`}>
            <ListRow>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{t.nickname}</p>
                <p className="truncate text-text-secondary">
                  {t.specialties.map((s) => s.service.name).join(", ") || "ยังไม่ระบุความถนัด"}
                </p>
                <p className="truncate text-text-secondary">
                  ค่ามือ: {t.commissionRate.toString()}
                  {t.commissionType === "PERCENTAGE" ? "%" : " บาท/ครั้ง"} · คะแนน{" "}
                  {t.ratingCount > 0 ? `${t.ratingAverage.toString()} (${t.ratingCount})` : "ยังไม่มี"}
                </p>
              </div>
              <Badge>{STATUS_LABEL[t.status] ?? t.status}</Badge>
            </ListRow>
          </Link>
        ))}
      </div>
    </div>
  );
}
