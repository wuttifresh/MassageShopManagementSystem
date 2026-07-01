"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sellPackage } from "../../../actions";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        ชื่อคอร์ส
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น คอร์สนวดแผนไทย 10 ครั้ง"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        ใช้ได้กับบริการ
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2"
        >
          <option value="">ทุกบริการ</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          จำนวนครั้ง
          <input
            type="number"
            min={1}
            value={totalSessions}
            onChange={(e) => setTotalSessions(e.target.value)}
            required
            className="rounded-lg border border-neutral-300 p-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          ราคา (บาท)
          <input
            type="number"
            min={0}
            step="0.01"
            value={pricePaid}
            onChange={(e) => setPricePaid(e.target.value)}
            required
            className="rounded-lg border border-neutral-300 p-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        วันหมดอายุ (ไม่บังคับ)
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? "กำลังบันทึก..." : "บันทึกการขาย"}
      </button>
    </form>
  );
}
