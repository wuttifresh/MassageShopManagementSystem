import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";

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
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
        <p>ยังไม่มีสาขาที่ใช้งานอยู่</p>
      </main>
    );
  }

  const therapists = await prisma.therapist.findMany({
    where: { branchId: activeBranchId, deletedAt: null },
    include: { specialties: { include: { service: true } } },
    orderBy: { nickname: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-400">
            ← กลับแดชบอร์ด
          </Link>
          <h1 className="text-xl font-semibold">จัดการหมอนวด</h1>
        </div>
        <Link
          href="/dashboard/therapists/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          + เพิ่มหมอนวด
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {therapists.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/therapists/${t.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm hover:border-neutral-900"
          >
            <div>
              <p className="font-medium">{t.nickname}</p>
              <p className="text-neutral-500">
                {t.specialties.map((s) => s.service.name).join(", ") || "ยังไม่ระบุความถนัด"}
              </p>
              <p className="text-neutral-500">
                ค่ามือ: {t.commissionRate.toString()}
                {t.commissionType === "PERCENTAGE" ? "%" : " บาท/ครั้ง"} · คะแนน{" "}
                {t.ratingCount > 0 ? `${t.ratingAverage.toString()} (${t.ratingCount})` : "ยังไม่มี"}
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
              {STATUS_LABEL[t.status] ?? t.status}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
