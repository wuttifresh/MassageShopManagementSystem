import Link from "next/link";
import { requireOwnerPage } from "@/lib/require-owner-page";
import { NewBranchForm } from "./new-branch-form";

export default async function NewBranchPage() {
  await requireOwnerPage("/dashboard/branches/new");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href="/dashboard/branches" className="text-sm text-neutral-400">
        ← กลับ
      </Link>
      <h1 className="text-xl font-semibold">เพิ่มสาขา</h1>
      <NewBranchForm />
    </main>
  );
}
