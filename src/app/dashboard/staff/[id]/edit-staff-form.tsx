"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateStaffAssignment } from "../actions";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Branch = { id: string; name: string };

export function EditStaffForm({
  userId,
  branches,
  initial,
}: {
  userId: string;
  branches: Branch[];
  initial: { branchId: string; isActive: boolean };
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(initial.branchId);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await updateStaffAssignment(userId, branchId, isActive);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/staff");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="สาขาที่ประจำ">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex items-center gap-2.5 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-[18px] w-[18px] rounded border-border text-primary focus:ring-primary/30"
        />
        บัญชีนี้ใช้งานได้ (ปิดไว้ = ล็อกอินไม่ได้)
      </label>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
