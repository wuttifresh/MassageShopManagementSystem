import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { EditBranchForm } from "./edit-branch-form";

export default async function EditBranchPage({ params }: { params: { id: string } }) {
  await requireOwnerPage(`/dashboard/branches/${params.id}`);

  const branch = await prisma.branch.findUnique({ where: { id: params.id } });
  if (!branch || branch.deletedAt) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href="/dashboard/branches" className="text-sm text-neutral-400">
        ← กลับ
      </Link>
      <h1 className="text-xl font-semibold">แก้ไขสาขา</h1>
      <EditBranchForm
        branchId={branch.id}
        initial={{
          name: branch.name,
          slug: branch.slug,
          address: branch.address ?? "",
          phone: branch.phone ?? "",
          openTime: branch.openTime,
          closeTime: branch.closeTime,
          isActive: branch.isActive,
        }}
      />
    </main>
  );
}
