"use client";

import { useState } from "react";
import { updateServiceOption } from "../actions";

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
  const [values, setValues] = useState<Values>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSave() {
    setError(null);
    setIsSubmitting(true);
    const result = await updateServiceOption(optionId, values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
      <p className="font-medium">{durationMinutes} นาที</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          ราคาปกติ
          <input
            type="number"
            min={0}
            step="0.01"
            value={values.price}
            onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
            className="rounded-lg border border-neutral-300 p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          ราคาโปรโมชั่น (ไม่บังคับ)
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="ไม่มีโปรโมชั่น"
            value={values.promoPrice}
            onChange={(e) => setValues((v) => ({ ...v, promoPrice: e.target.value }))}
            className="rounded-lg border border-neutral-300 p-2"
          />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
        />
        เปิดขายตัวเลือกนี้
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSave}
          className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        {savedAt && <span className="text-xs text-green-600">บันทึกแล้ว</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
