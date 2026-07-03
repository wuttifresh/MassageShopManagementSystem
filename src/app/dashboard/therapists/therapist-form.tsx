"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="ชื่อเล่น" required>
        <Input
          value={values.nickname}
          onChange={(e) => setValues((v) => ({ ...v, nickname: e.target.value }))}
          required
        />
      </Field>

      <Field label="แนะนำตัว" hint="ไม่บังคับ">
        <Textarea
          value={values.bio}
          onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))}
          rows={2}
        />
      </Field>

      {isEditing && (
        <Field label="สถานะ">
          <Select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as TherapistFormValues["status"] }))}
          >
            <option value="ACTIVE">พร้อมทำงาน</option>
            <option value="ON_LEAVE">ลาพัก</option>
            <option value="INACTIVE">ไม่ทำงานแล้ว</option>
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="ประเภทค่ามือ">
          <Select
            value={values.commissionType}
            onChange={(e) =>
              setValues((v) => ({ ...v, commissionType: e.target.value as TherapistFormValues["commissionType"] }))
            }
          >
            <option value="PERCENTAGE">เปอร์เซ็นต์ (%)</option>
            <option value="FIXED_AMOUNT">บาท/ครั้ง</option>
          </Select>
        </Field>
        <Field label="อัตราค่ามือ" required>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={values.commissionRate}
            onChange={(e) => setValues((v) => ({ ...v, commissionRate: e.target.value }))}
            required
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium text-gray-700">ความถนัด</legend>
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          {services.length === 0 && <p className="text-text-secondary">ยังไม่มีบริการในระบบ</p>}
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2.5 text-gray-700">
              <input
                type="checkbox"
                checked={values.specialtyServiceIds.includes(s.id)}
                onChange={() => toggleSpecialty(s.id)}
                className="h-[18px] w-[18px] rounded border-border text-primary focus:ring-primary/30"
              />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
