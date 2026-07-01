"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Service = { id: string; name: string };

export type TherapistFormValues = {
  nickname: string;
  bio: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  commissionType: "PERCENTAGE" | "FIXED_AMOUNT";
  commissionRate: string;
  specialtyServiceIds: string[];
};

const DEFAULT_VALUES: TherapistFormValues = {
  nickname: "",
  bio: "",
  status: "ACTIVE",
  commissionType: "PERCENTAGE",
  commissionRate: "40",
  specialtyServiceIds: [],
};

export function TherapistForm({
  services,
  initial,
  isEditing,
  onSubmit,
}: {
  services: Service[];
  initial?: TherapistFormValues;
  isEditing: boolean;
  onSubmit: (input: TherapistFormValues) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TherapistFormValues>(initial ?? DEFAULT_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSpecialty(serviceId: string) {
    setValues((v) => ({
      ...v,
      specialtyServiceIds: v.specialtyServiceIds.includes(serviceId)
        ? v.specialtyServiceIds.filter((id) => id !== serviceId)
        : [...v.specialtyServiceIds, serviceId],
    }));
  }

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
    router.push("/dashboard/therapists");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        ชื่อเล่น
        <input
          value={values.nickname}
          onChange={(e) => setValues((v) => ({ ...v, nickname: e.target.value }))}
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        แนะนำตัว
        <textarea
          value={values.bio}
          onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))}
          className="rounded-lg border border-neutral-300 p-2"
          rows={2}
        />
      </label>

      {isEditing && (
        <label className="flex flex-col gap-1 text-sm">
          สถานะ
          <select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as TherapistFormValues["status"] }))}
            className="rounded-lg border border-neutral-300 p-2"
          >
            <option value="ACTIVE">พร้อมทำงาน</option>
            <option value="ON_LEAVE">ลาพัก</option>
            <option value="INACTIVE">ไม่ทำงานแล้ว</option>
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          ประเภทค่ามือ
          <select
            value={values.commissionType}
            onChange={(e) =>
              setValues((v) => ({ ...v, commissionType: e.target.value as TherapistFormValues["commissionType"] }))
            }
            className="rounded-lg border border-neutral-300 p-2"
          >
            <option value="PERCENTAGE">เปอร์เซ็นต์ (%)</option>
            <option value="FIXED_AMOUNT">บาท/ครั้ง</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          อัตราค่ามือ
          <input
            type="number"
            min={0}
            step="0.01"
            value={values.commissionRate}
            onChange={(e) => setValues((v) => ({ ...v, commissionRate: e.target.value }))}
            required
            className="rounded-lg border border-neutral-300 p-2"
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">ความถนัด</legend>
        {services.map((s) => (
          <label key={s.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.specialtyServiceIds.includes(s.id)}
              onChange={() => toggleSpecialty(s.id)}
            />
            {s.name}
          </label>
        ))}
      </fieldset>

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
