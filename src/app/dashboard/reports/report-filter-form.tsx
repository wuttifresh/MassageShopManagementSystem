"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      {showBranchPicker && (
        <Field label="สาขา" className="col-span-2 sm:w-48">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="ตั้งแต่วันที่" className="sm:w-44">
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="ถึงวันที่" className="sm:w-44">
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <Button type="submit" className="col-span-2 sm:col-span-1">
        ดูรายงาน
      </Button>
    </form>
  );
}
