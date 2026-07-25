"use client";

import { useState } from "react";
import { updateProduct } from "../actions";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

type Values = { name: string; price: string; stockQuantity: string; isActive: boolean };

export function EditProductForm({ productId, initial }: { productId: string; initial: Values }) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Values>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await updateProduct(productId, values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    showToast({ variant: "success", title: "บันทึกข้อมูลสินค้าแล้ว" });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="ชื่อสินค้า" required>
        <Input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />
      </Field>

      <Field label="ราคา (บาท)" required>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={values.price}
          onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
          required
        />
      </Field>

      <Field label="จำนวนสต๊อกคงเหลือ" required hint="ปรับได้โดยตรง เช่น ตอนรับของเข้าใหม่">
        <Input
          type="number"
          min={0}
          step="1"
          value={values.stockQuantity}
          onChange={(e) => setValues((v) => ({ ...v, stockQuantity: e.target.value }))}
          required
        />
      </Field>

      <label className="flex items-center gap-2.5 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
          className="h-[18px] w-[18px] rounded border-border text-primary focus:ring-primary/30"
        />
        เปิดขายสินค้านี้
      </label>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
