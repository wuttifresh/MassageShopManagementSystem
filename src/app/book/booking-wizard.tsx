"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "./actions";

type Branch = { id: string; name: string; slug: string; address: string | null };
type ServiceOption = { id: string; durationMinutes: number; price: string; promoPrice: string | null };
type Service = { id: string; name: string; description: string | null; options: ServiceOption[] };
type Therapist = { id: string; nickname: string; bio: string | null };

type Step = "branch" | "service" | "duration" | "therapist" | "datetime" | "confirm" | "done";

const DAY_COUNT = 14;
const WEEKDAY_FORMAT = new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "UTC" });
const DAY_FORMAT = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDays(count: number): Date[] {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Array.from({ length: count }, (_, i) => new Date(base.getTime() + i * 86_400_000));
}

export function BookingWizard() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("branch");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [slots, setSlots] = useState<string[]>([]);

  const [branchId, setBranchId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceOptionId, setServiceOptionId] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState<string | null | "ANY">("ANY");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => nextDays(DAY_COUNT), []);
  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedOption = selectedService?.options.find((o) => o.id === serviceOptionId) ?? null;
  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;
  const selectedTherapist = therapists.find((t) => t.id === therapistId) ?? null;

  // Step 1: load branches, auto-skip if there's only one.
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data: { branches: Branch[] }) => {
        setBranches(data.branches);
        if (data.branches.length === 1) {
          setBranchId(data.branches[0].id);
          setStep("service");
        }
      });
  }, []);

  // Step 2: load services once a branch is chosen.
  useEffect(() => {
    if (step !== "service" || services.length > 0) return;
    fetch("/api/services")
      .then((r) => r.json())
      .then((data: { services: Service[] }) => setServices(data.services));
  }, [step, services.length]);

  // Step 4: load eligible therapists once service is chosen.
  useEffect(() => {
    if (step !== "therapist" || !branchId || !serviceId) return;
    fetch(`/api/therapists?branchId=${branchId}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data: { therapists: Therapist[] }) => setTherapists(data.therapists));
  }, [step, branchId, serviceId]);

  // Step 5: load available slots whenever date/therapist selection changes.
  useEffect(() => {
    if (step !== "datetime" || !branchId || !serviceId || !selectedOption || !date) return;
    setSlots([]);
    setTime(null);
    const params = new URLSearchParams({
      branchId,
      serviceId,
      date,
      durationMinutes: String(selectedOption.durationMinutes),
    });
    if (therapistId && therapistId !== "ANY") params.set("therapistId", therapistId);

    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots));
  }, [step, branchId, serviceId, selectedOption, therapistId, date]);

  async function handleConfirm() {
    if (!branchId || !serviceOptionId || !date || !time) return;
    setIsLoading(true);
    setError(null);

    const result = await createBooking({
      branchId,
      serviceOptionId,
      therapistId: therapistId === "ANY" ? null : therapistId,
      date,
      time,
    });

    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-700">จองคิวสำเร็จ!</p>
        <p className="text-sm text-neutral-600">เจอกันที่ร้านตามเวลาที่จองไว้นะคะ</p>
        <button
          type="button"
          onClick={() => router.push("/account")}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          ดูการจองของฉัน
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb step={step} />

      {step === "branch" && (
        <StepList
          items={branches.map((b) => ({ id: b.id, label: b.name, sub: b.address ?? undefined }))}
          onSelect={(id) => {
            setBranchId(id);
            setStep("service");
          }}
        />
      )}

      {step === "service" && (
        <StepList
          items={services.map((s) => ({ id: s.id, label: s.name, sub: s.description ?? undefined }))}
          onSelect={(id) => {
            setServiceId(id);
            setServiceOptionId(null);
            setStep("duration");
          }}
        />
      )}

      {step === "duration" && selectedService && (
        <StepList
          items={selectedService.options.map((o) => ({
            id: o.id,
            label: `${o.durationMinutes} นาที`,
            sub: o.promoPrice ? `฿${o.promoPrice} (ปกติ ฿${o.price})` : `฿${o.price}`,
          }))}
          onSelect={(id) => {
            setServiceOptionId(id);
            setStep("therapist");
          }}
        />
      )}

      {step === "therapist" && (
        <StepList
          items={[
            { id: "ANY", label: "คนไหนก็ได้", sub: "ระบบจะเลือกหมอนวดที่ว่างให้อัตโนมัติ" },
            ...therapists.map((t) => ({ id: t.id, label: t.nickname, sub: t.bio ?? undefined })),
          ]}
          onSelect={(id) => {
            setTherapistId(id as string | "ANY");
            setStep("datetime");
          }}
        />
      )}

      {step === "datetime" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => {
              const value = isoDate(d);
              const selected = value === date;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDate(value)}
                  className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-xs ${
                    selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"
                  }`}
                >
                  <span>{WEEKDAY_FORMAT.format(d)}</span>
                  <span className="font-medium">{DAY_FORMAT.format(d)}</span>
                </button>
              );
            })}
          </div>

          {date && (
            <div className="grid grid-cols-3 gap-2">
              {slots.length === 0 && (
                <p className="col-span-3 text-center text-sm text-neutral-400">
                  ไม่มีคิวว่างในวันนี้ ลองเลือกวันอื่นดูนะคะ
                </p>
              )}
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    setTime(slot);
                    setStep("confirm");
                  }}
                  className="rounded-lg border border-neutral-300 py-2 text-sm hover:border-neutral-900"
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "confirm" && selectedBranch && selectedService && selectedOption && date && time && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4 text-sm">
            <Row label="สาขา" value={selectedBranch.name} />
            <Row label="บริการ" value={`${selectedService.name} (${selectedOption.durationMinutes} นาที)`} />
            <Row label="หมอนวด" value={selectedTherapist ? selectedTherapist.nickname : "คนไหนก็ได้"} />
            <Row label="วันที่" value={DAY_FORMAT.format(new Date(date))} />
            <Row label="เวลา" value={time} />
            <Row
              label="ราคา"
              value={
                selectedOption.promoPrice
                  ? `฿${selectedOption.promoPrice} (ปกติ ฿${selectedOption.price})`
                  : `฿${selectedOption.price}`
              }
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className="rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {isLoading ? "กำลังยืนยัน..." : "ยืนยันการจอง"}
          </button>
        </div>
      )}

      {step !== "branch" && (
        <button type="button" onClick={() => goBack(step, setStep)} className="text-sm text-neutral-400">
          ← ย้อนกลับ
        </button>
      )}
    </div>
  );
}

function goBack(step: Step, setStep: (s: Step) => void) {
  const order: Step[] = ["branch", "service", "duration", "therapist", "datetime", "confirm"];
  const idx = order.indexOf(step);
  if (idx > 0) setStep(order[idx - 1]);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Breadcrumb({ step }: { step: Step }) {
  const labels: Record<Step, string> = {
    branch: "เลือกสาขา",
    service: "เลือกบริการ",
    duration: "เลือกระยะเวลา",
    therapist: "เลือกหมอนวด",
    datetime: "เลือกวัน-เวลา",
    confirm: "ยืนยันการจอง",
    done: "เสร็จสิ้น",
  };
  return <p className="text-sm font-medium text-neutral-500">{labels[step]}</p>;
}

function StepList({
  items,
  onSelect,
}: {
  items: { id: string; label: string; sub?: string }[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-400">กำลังโหลด...</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex flex-col rounded-lg border border-neutral-300 p-3 text-left hover:border-neutral-900"
        >
          <span className="font-medium">{item.label}</span>
          {item.sub && <span className="text-sm text-neutral-500">{item.sub}</span>}
        </button>
      ))}
    </div>
  );
}
