"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateStaffAssignment } from "../actions";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        สาขาที่ประจำ
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        บัญชีนี้ใช้งานได้ (ปิดไว้ = ล็อกอินไม่ได้)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}
