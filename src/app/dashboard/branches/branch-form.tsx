"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type BranchFormValues = {
  name: string;
  slug: string;
  address: string;
  phone: string;
  openTime: string;
  closeTime: string;
  isActive: boolean;
};

const DEFAULT_VALUES: BranchFormValues = {
  name: "",
  slug: "",
  address: "",
  phone: "",
  openTime: "10:00",
  closeTime: "22:00",
  isActive: true,
};

export function BranchForm({
  initial,
  isEditing,
  onSubmit,
}: {
  initial?: BranchFormValues;
  isEditing: boolean;
  onSubmit: (input: BranchFormValues) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<BranchFormValues>(initial ?? DEFAULT_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    router.push("/dashboard/branches");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        ชื่อสาขา
        <input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        slug (ใช้ใน URL เช่น siam-square)
        <input
          value={values.slug}
          onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value.toLowerCase() }))}
          required
          pattern="[a-z0-9-]+"
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        ที่อยู่
        <input
          value={values.address}
          onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        เบอร์โทร
        <input
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          เวลาเปิด
          <input
            type="time"
            value={values.openTime}
            onChange={(e) => setValues((v) => ({ ...v, openTime: e.target.value }))}
            className="rounded-lg border border-neutral-300 p-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          เวลาปิด
          <input
            type="time"
            value={values.closeTime}
            onChange={(e) => setValues((v) => ({ ...v, closeTime: e.target.value }))}
            className="rounded-lg border border-neutral-300 p-2"
          />
        </label>
      </div>

      {isEditing && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
          />
          เปิดใช้งานสาขานี้
        </label>
      )}

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
