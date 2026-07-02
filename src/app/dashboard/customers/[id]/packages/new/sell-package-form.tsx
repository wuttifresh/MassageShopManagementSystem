"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sellPackage } from "../../../actions";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Service = { id: string; name: string };

export function SellPackageForm({
  customerId,
  branchId,
  services,
}: {
  customerId: string;
  branchId: string;
  services: Service[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [totalSessions, setTotalSessions] = useState("10");
  const [pricePaid, setPricePaid] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await sellPackage({
      customerId,
      branchId,
      serviceId: serviceId || null,
      name,
      totalSessions,
      pricePaid,
      expiresAt: expiresAt || undefined,
    });

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/customers/${customerId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="ชื่อคอร์ส" required>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น คอร์สนวดแผนไทย 10 ครั้ง"
          required
        />
      </Field>

      <Field label="ใช้ได้กับบริการ">
        <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">ทุกบริการ</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="จำนวนครั้ง" required>
          <Input
            type="number"
            min={1}
            value={totalSessions}
            onChange={(e) => setTotalSessions(e.target.value)}
            required
          />
        </Field>
        <Field label="ราคา (บาท)" required>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={pricePaid}
            onChange={(e) => setPricePaid(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="วันหมดอายุ" hint="ไม่บังคับ">
        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </Field>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึกการขาย
      </Button>
    </form>
  );
}
