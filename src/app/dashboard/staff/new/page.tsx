import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { NewStaffForm } from "./new-staff-form";

export default async function NewStaffPage() {
  await requireOwnerPage("/dashboard/staff/new");

  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href="/dashboard/staff" className="text-sm text-neutral-400">
        ← กลับ
      </Link>
      <h1 className="text-xl font-semibold">เพิ่มพนักงาน</h1>
      <NewStaffForm branches={branches} />
    </main>
  );
}
