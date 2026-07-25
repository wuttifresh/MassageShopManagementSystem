"use client";

import { useState } from "react";
import type { DiscountType } from "@/generated/prisma/client";
import { updateVoucher } from "../actions";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

type Values = {
  discountType: DiscountType;
  discountValue: string;
  maxRedemptions: string;
  expiresAt: string;
  isActive: boolean;
};

export function EditVoucherForm({
  voucherId,
  initial,
  redemptionCount,
}: {
  voucherId: string;
  initial: Values;
  redemptionCount: number;
}) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Values>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await updateVoucher(voucherId, values);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    showToast({ variant: "success", title: "บันทึกรหัสส่วนลดแล้ว" });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">ใช้ไปแล้ว {redemptionCount} ครั้ง</p>

      <Field label="ประเภทส่วนลด" required>
        <Select
          value={values.discountType}
          onChange={(e) => setValues((v) => ({ ...v, discountType: e.target.value as DiscountType }))}
        >
          <option value="PERCENTAGE">เปอร์เซ็นต์ (%)</option>
          <option value="FIXED_AMOUNT">จำนวนเงิน (บาท)</option>
        </Select>
      </Field>

      <Field label={values.discountType === "PERCENTAGE" ? "ส่วนลด (%)" : "ส่วนลด (บาท)"} required>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={values.discountValue}
          onChange={(e) => setValues((v) => ({ ...v, discountValue: e.target.value }))}
          required
        />
      </Field>

      <Field label="จำนวนครั้งที่ใช้ได้" hint="เว้นว่าง = ไม่จำกัด">
        <Input
          type="number"
          min={1}
          step="1"
          value={values.maxRedemptions}
          onChange={(e) => setValues((v) => ({ ...v, maxRedemptions: e.target.value }))}
        />
      </Field>

      <Field label="วันหมดอายุ" hint="เว้นว่าง = ไม่มีวันหมดอายุ">
        <Input
          type="date"
          value={values.expiresAt}
          onChange={(e) => setValues((v) => ({ ...v, expiresAt: e.target.value }))}
        />
      </Field>

      <label className="flex items-center gap-2.5 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
          className="h-[18px] w-[18px] rounded border-border text-primary focus:ring-primary/30"
        />
        เปิดใช้งานรหัสนี้
      </label>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
