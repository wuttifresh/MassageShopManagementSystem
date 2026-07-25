"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DiscountType } from "@/generated/prisma/client";
import { createVoucher } from "../actions";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function NewVoucherForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await createVoucher({ code, discountType, discountValue, maxRedemptions, expiresAt });

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/vouchers");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="รหัสส่วนลด" required hint="เช่น SUMMER10 (ไม่สนตัวพิมพ์เล็ก-ใหญ่)">
        <Input value={code} onChange={(e) => setCode(e.target.value)} required />
      </Field>

      <Field label="ประเภทส่วนลด" required>
        <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
          <option value="PERCENTAGE">เปอร์เซ็นต์ (%)</option>
          <option value="FIXED_AMOUNT">จำนวนเงิน (บาท)</option>
        </Select>
      </Field>

      <Field label={discountType === "PERCENTAGE" ? "ส่วนลด (%)" : "ส่วนลด (บาท)"} required>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
          required
        />
      </Field>

      <Field label="จำนวนครั้งที่ใช้ได้" hint="เว้นว่าง = ไม่จำกัด">
        <Input type="number" min={1} step="1" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
      </Field>

      <Field label="วันหมดอายุ" hint="เว้นว่าง = ไม่มีวันหมดอายุ">
        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </Field>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
