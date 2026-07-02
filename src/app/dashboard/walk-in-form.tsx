"use client";

import { useEffect, useState } from "react";
import { addWalkInQueue } from "./actions";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

type ServiceOption = { id: string; durationMinutes: number; price: string; promoPrice: string | null };
type Service = { id: string; name: string; options: ServiceOption[] };
type Therapist = { id: string; nickname: string };

export function WalkInForm({ branchId }: { branchId: string }) {
  const { showToast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [serviceOptionId, setServiceOptionId] = useState("");
  const [therapistId, setTherapistId] = useState(""); // "" = any therapist
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    showToast({ variant: "success", title: "เพิ่มคิวสำเร็จ" });
    setGuestName("");
    setGuestPhone("");
    setServiceId("");
    setServiceOptionId("");
    setTherapistId("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="ชื่อลูกค้า"
          required
        />
        <Input
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          placeholder="เบอร์โทร (ไม่บังคับ)"
        />
      </div>

      <Select
        value={serviceId}
        onChange={(e) => {
          setServiceId(e.target.value);
          setServiceOptionId("");
        }}
        required
      >
        <option value="">เลือกบริการ</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      {selectedService && (
        <Select value={serviceOptionId} onChange={(e) => setServiceOptionId(e.target.value)} required>
          <option value="">เลือกระยะเวลา</option>
          {selectedService.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.durationMinutes} นาที ({o.promoPrice ? `฿${o.promoPrice} ปกติ ฿${o.price}` : `฿${o.price}`})
            </option>
          ))}
        </Select>
      )}

      {serviceId && (
        <Select value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
          <option value="">คนไหนก็ได้ (มอบหมายทีหลัง)</option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nickname}
            </option>
          ))}
        </Select>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" variant="secondary" isLoading={isSubmitting} fullWidth>
        + เพิ่มคิว
      </Button>
    </form>
  );
}
