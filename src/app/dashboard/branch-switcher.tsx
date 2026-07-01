"use client";

import { useRouter } from "next/navigation";

type Branch = { id: string; name: string };

export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: Branch[];
  activeBranchId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={activeBranchId}
      onChange={(e) => router.push(`/dashboard?branchId=${e.target.value}`)}
      className="rounded-lg border border-neutral-300 p-2 text-sm"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
