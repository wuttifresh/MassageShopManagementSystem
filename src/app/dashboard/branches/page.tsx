import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";

export default async function BranchesPage() {
  await requireOwnerPage("/dashboard/branches");

  const branches = await prisma.branch.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-400">
            ← กลับแดชบอร์ด
          </Link>
          <h1 className="text-xl font-semibold">จัดการสาขา</h1>
        </div>
        <Link
          href="/dashboard/branches/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          + เพิ่มสาขา
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {branches.map((b) => (
          <Link
            key={b.id}
            href={`/dashboard/branches/${b.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm hover:border-neutral-900"
          >
            <div>
              <p className="font-medium">{b.name}</p>
              <p className="text-neutral-500">
                {b.address ?? "ไม่มีที่อยู่"} · {b.openTime}-{b.closeTime}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                b.isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {b.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
