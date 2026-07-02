"use client";

import { useState } from "react";
import { updateService } from "../actions";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

type Values = { name: string; category: string; description: string; isActive: boolean };

export function EditServiceForm({ serviceId, initial }: { serviceId: string; initial: Values }) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Values>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await updateService(serviceId, values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    showToast({ variant: "success", title: "บันทึกข้อมูลบริการแล้ว" });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="ชื่อบริการ" required>
        <Input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />
      </Field>

      <Field label="หมวดหมู่">
        <Input value={values.category} onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))} />
      </Field>

      <Field label="รายละเอียด">
        <Textarea
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={2}
        />
      </Field>

      <label className="flex items-center gap-2.5 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
          className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary/30"
        />
        เปิดขายบริการนี้
      </label>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
