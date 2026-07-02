"use client";

import { useEffect, useState } from "react";
import { addWalkInQueue } from "./actions";

type ServiceOption = { id: string; durationMinutes: number; price: string; promoPrice: string | null };
type Service = { id: string; name: string; options: ServiceOption[] };
type Therapist = { id: string; nickname: string };

export function WalkInForm({ branchId }: { branchId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [serviceOptionId, setServiceOptionId] = useState("");
  const [therapistId, setTherapistId] = useState(""); // "" = any therapist
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data: { services: Service[] }) => setServices(data.services));
  }, []);

  useEffect(() => {
    setTherapistId("");
    setTherapists([]);
    if (!serviceId) return;
    fetch(`/api/therapists?branchId=${branchId}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data: { therapists: Therapist[] }) => setTherapists(data.therapists));
  }, [branchId, serviceId]);

  const selectedService = services.find((s) => s.id === serviceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!serviceOptionId) {
      setError("กรุณาเลือกบริการ");
      return;
    }

    setIsSubmitting(true);
    const result = await addWalkInQueue({
      branchId,
      serviceOptionId,
      therapistId: therapistId || null,
      guestName,
      guestPhone,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSuccess(`เพิ่มคิวสำเร็จ`);
    setGuestName("");
    setGuestPhone("");
    setServiceId("");
    setServiceOptionId("");
    setTherapistId("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="ชื่อลูกค้า"
          required
          className="rounded-lg border border-neutral-300 p-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        <input
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          placeholder="เบอร์โทร (ไม่บังคับ)"
          className="rounded-lg border border-neutral-300 p-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
      </div>

      <select
        value={serviceId}
        onChange={(e) => {
          setServiceId(e.target.value);
          setServiceOptionId("");
        }}
        required
        className="rounded-lg border border-neutral-300 p-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      >
        <option value="">เลือกบริการ</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {selectedService && (
        <select
          value={serviceOptionId}
          onChange={(e) => setServiceOptionId(e.target.value)}
          required
          className="rounded-lg border border-neutral-300 p-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        >
          <option value="">เลือกระยะเวลา</option>
          {selectedService.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.durationMinutes} นาที ({o.promoPrice ? `฿${o.promoPrice} ปกติ ฿${o.price}` : `฿${o.price}`})
            </option>
          ))}
        </select>
      )}

      {serviceId && (
        <select
          value={therapistId}
          onChange={(e) => setTherapistId(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        >
          <option value="">คนไหนก็ได้ (มอบหมายทีหลัง)</option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nickname}
            </option>
          ))}
        </select>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
      >
        {isSubmitting ? "กำลังเพิ่ม..." : "+ เพิ่มคิว"}
      </button>
    </form>
  );
}
