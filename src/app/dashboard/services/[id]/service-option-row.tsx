"use client";

import { useState } from "react";
import { updateServiceOption } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Values = { price: string; promoPrice: string; isActive: boolean };

export function ServiceOptionRow({
  optionId,
  durationMinutes,
  initial,
}: {
  optionId: string;
  durationMinutes: number;
  initial: Values;
}) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Values>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setIsSubmitting(true);
    const result = await updateServiceOption(optionId, values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    showToast({ variant: "success", title: `บันทึกตัวเลือก ${durationMinutes} นาทีแล้ว` });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3.5 text-sm">
      <p className="font-medium text-gray-900">{durationMinutes} นาที</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          ราคาปกติ
          <Input
            type="number"
            min={0}
            step="0.01"
            value={values.price}
            onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          ราคาโปรโมชั่น
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="ไม่มีโปรโมชั่น"
            value={values.promoPrice}
            onChange={(e) => setValues((v) => ({ ...v, promoPrice: e.target.value }))}
          />
        </label>
      </div>
      <label className="flex items-center gap-2.5 text-gray-700">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
          className="h-[18px] w-[18px] rounded border-border text-primary focus:ring-primary/30"
        />
        เปิดขายตัวเลือกนี้
      </label>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" isLoading={isSubmitting} onClick={handleSave}>
          บันทึก
        </Button>
        {error && <span className="text-xs font-medium text-danger">{error}</span>}
      </div>
    </div>
  );
}
