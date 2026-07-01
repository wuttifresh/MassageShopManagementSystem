"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Branch = { id: string; name: string };

export function ReportFilterForm({
  branches,
  activeBranchId,
  startDate,
  endDate,
  showBranchPicker,
}: {
  branches: Branch[];
  activeBranchId: string;
  startDate: string;
  endDate: string;
  showBranchPicker: boolean;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(activeBranchId);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/dashboard/reports?branchId=${branchId}&startDate=${start}&endDate=${end}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      {showBranchPicker && (
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          สาขา
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="rounded-lg border border-neutral-300 p-2 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        ตั้งแต่วันที่
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        ถึงวันที่
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2 text-sm"
        />
      </label>
      <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
        ดูรายงาน
      </button>
    </form>
  );
}
