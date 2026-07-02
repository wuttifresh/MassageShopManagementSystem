"use client";

import { usePathname, useRouter } from "next/navigation";

type Branch = { id: string; name: string };

export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: Branch[];
  activeBranchId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={activeBranchId}
      onChange={(e) => router.push(`${pathname}?branchId=${e.target.value}`)}
      className="flex-1 rounded-lg border border-neutral-300 p-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
