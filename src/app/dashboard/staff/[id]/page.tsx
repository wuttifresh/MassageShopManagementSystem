import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { EditStaffForm } from "./edit-staff-form";

export default async function EditStaffPage({ params }: { params: { id: string } }) {
  await requireOwnerPage(`/dashboard/staff/${params.id}`);

  const staffMember = await prisma.user.findUnique({ where: { id: params.id } });
  if (!staffMember || staffMember.role !== "STAFF" || staffMember.deletedAt) notFound();

  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href="/dashboard/staff" className="text-sm text-neutral-400">
        ← กลับ
      </Link>
      <h1 className="text-xl font-semibold">แก้ไข {staffMember.name}</h1>
      <EditStaffForm
        userId={staffMember.id}
        branches={branches}
        initial={{ branchId: staffMember.branchId ?? branches[0]?.id ?? "", isActive: staffMember.isActive }}
      />
    </main>
  );
}
