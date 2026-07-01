import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";

export default async function StaffPage() {
  await requireOwnerPage("/dashboard/staff");

  const staff = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "STAFF"] }, deletedAt: null },
    include: { branch: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-400">
            ← กลับแดชบอร์ด
          </Link>
          <h1 className="text-xl font-semibold">พนักงาน</h1>
        </div>
        <Link
          href="/dashboard/staff/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          + เพิ่มพนักงาน
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm">
            <div>
              <p className="font-medium">
                {s.name} <span className="text-neutral-400">({s.role})</span>
              </p>
              <p className="text-neutral-500">
                {s.email} · {s.branch?.name ?? "ทุกสาขา"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  s.isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {s.isActive ? "ใช้งานได้" : "ปิดใช้งาน"}
              </span>
              {s.role === "STAFF" && (
                <Link href={`/dashboard/staff/${s.id}`} className="text-neutral-400 underline">
                  แก้ไข
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
