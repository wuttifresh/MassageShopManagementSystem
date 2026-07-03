"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="ชื่อสาขา" required>
        <Input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />
      </Field>

      <Field label="slug" required hint="ใช้ใน URL เช่น siam-square">
        <Input
          value={values.slug}
          onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value.toLowerCase() }))}
          required
          pattern="[a-z0-9-]+"
        />
      </Field>

      <Field label="ที่อยู่" hint="ไม่บังคับ">
        <Input value={values.address} onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))} />
      </Field>

      <Field label="เบอร์โทร" hint="ไม่บังคับ">
        <Input value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="เวลาเปิด">
          <Input
            type="time"
            value={values.openTime}
            onChange={(e) => setValues((v) => ({ ...v, openTime: e.target.value }))}
          />
        </Field>
        <Field label="เวลาปิด">
          <Input
            type="time"
            value={values.closeTime}
            onChange={(e) => setValues((v) => ({ ...v, closeTime: e.target.value }))}
          />
        </Field>
      </div>

      {isEditing && (
        <label className="flex items-center gap-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
            className="h-[18px] w-[18px] rounded border-border text-primary focus:ring-primary/30"
          />
          เปิดใช้งานสาขานี้
        </label>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
