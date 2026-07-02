"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "./actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

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
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-success/20 bg-success-light p-6 text-center animate-slide-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-success-hover">จองคิวสำเร็จ!</p>
        <p className="text-sm text-gray-600">เจอกันที่ร้านตามเวลาที่จองไว้นะคะ</p>
        <Button type="button" onClick={() => router.push("/account")}>
          ดูการจองของฉัน
        </Button>
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
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2.5 text-xs transition-colors",
                    selected ? "border-primary bg-primary text-white shadow-soft" : "border-border bg-card text-gray-700 hover:border-primary/40"
                  )}
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
                <p className="col-span-3 text-center text-sm text-text-secondary">
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
                  className="rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:bg-primary-light hover:text-primary"
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
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
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

          {error && <Alert variant="danger">{error}</Alert>}

          <Button type="button" size="lg" isLoading={isLoading} onClick={handleConfirm} fullWidth>
            ยืนยันการจอง
          </Button>
        </div>
      )}

      {step !== "branch" && (
        <button
          type="button"
          onClick={() => goBack(step, setStep)}
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
          ย้อนกลับ
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
    <div className="flex justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

const STEP_ORDER: Step[] = ["branch", "service", "duration", "therapist", "datetime", "confirm"];

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
  const currentIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        {STEP_ORDER.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= currentIndex ? "bg-primary" : "bg-gray-200"
            )}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-text-secondary">
        ขั้นตอน {currentIndex + 1}/{STEP_ORDER.length} · {labels[step]}
      </p>
    </div>
  );
}

function StepList({
  items,
  onSelect,
}: {
  items: { id: string; label: string; sub?: string }[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex flex-col rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
        >
          <span className="font-medium text-gray-900">{item.label}</span>
          {item.sub && <span className="text-sm text-text-secondary">{item.sub}</span>}
        </button>
      ))}
    </div>
  );
}
