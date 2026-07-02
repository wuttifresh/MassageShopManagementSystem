"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

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
    <Select
      value={activeBranchId}
      onChange={(e) => router.push(`${pathname}?branchId=${e.target.value}`)}
      className="max-w-xs"
      aria-label="เลือกสาขา"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </Select>
  );
}
