"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/i18n/locale-provider";
import type { Dictionary } from "@/i18n/get-dictionary";

type Branch = { id: string; name: string; slug: string; address: string | null };
type ServiceOption = { id: string; durationMinutes: number; price: string; promoPrice: string | null };
type Service = { id: string; name: string; description: string | null; options: ServiceOption[] };
type Therapist = { id: string; nickname: string; bio: string | null };

type Step = "branch" | "service" | "duration" | "therapist" | "datetime" | "details" | "otp" | "confirm" | "done";
const STEP_ORDER: Step[] = ["branch", "service", "duration", "therapist", "datetime", "details", "otp", "confirm"];

const DAY_COUNT = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDays(count: number): Date[] {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Array.from({ length: count }, (_, i) => new Date(base.getTime() + i * 86_400_000));
}

export function BookNowWizard({
  initialBranchSlug,
  initialServiceOptionId,
}: {
  /// Preselects a branch by its stable `slug` (from a "ลิงก์ร้าน" share link) — skips the branch
  /// step entirely once resolved. See /dashboard/booking-links.
  initialBranchSlug?: string;
  /// Preselects a service+duration by service option id (from a "ลิงก์เฉพาะ service/promo" share
  /// link) — skips both the service and duration steps once resolved.
  initialServiceOptionId?: string;
}) {
  const { dict, locale } = useTranslation();
  const intlLocale = locale === "th" ? "th-TH" : "en-US";
  const weekdayFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" }),
    [intlLocale]
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", timeZone: "UTC" }),
    [intlLocale]
  );

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
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneToken, setPhoneToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState<string | null>(null);

  const days = useMemo(() => nextDays(DAY_COUNT), []);
  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedOption = selectedService?.options.find((o) => o.id === serviceOptionId) ?? null;
  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;
  const selectedTherapist = therapists.find((t) => t.id === therapistId) ?? null;

  // Loads branches + services up front (not gated on step) so a share link's `?branch=`/`?option=`
  // can resolve and skip steps before the user ever sees them, instead of only after they'd
  // normally have reached that step.
  useEffect(() => {
    Promise.all([
      fetch("/api/branches").then((r) => r.json()) as Promise<{ branches: Branch[] }>,
      fetch("/api/services").then((r) => r.json()) as Promise<{ services: Service[] }>,
    ]).then(([branchesData, servicesData]) => {
      setBranches(branchesData.branches);
      setServices(servicesData.services);

      const matchedBranch = initialBranchSlug
        ? branchesData.branches.find((b) => b.slug === initialBranchSlug)
        : branchesData.branches.length === 1
          ? branchesData.branches[0]
          : null;

      let matchedService: Service | null = null;
      let matchedOption: ServiceOption | null = null;
      if (initialServiceOptionId) {
        for (const s of servicesData.services) {
          const opt = s.options.find((o) => o.id === initialServiceOptionId);
          if (opt) {
            matchedService = s;
            matchedOption = opt;
            break;
          }
        }
      }

      if (matchedBranch) setBranchId(matchedBranch.id);
      if (matchedService && matchedOption) {
        setServiceId(matchedService.id);
        setServiceOptionId(matchedOption.id);
      }

      if (matchedBranch && matchedService && matchedOption) {
        setStep("therapist");
      } else if (matchedBranch) {
        setStep("service");
      }
    });
    // Only ever runs once on mount — initialBranchSlug/initialServiceOptionId come from the URL
    // and don't change during the wizard's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "therapist" || !branchId || !serviceId) return;
    fetch(`/api/therapists?branchId=${branchId}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data: { therapists: Therapist[] }) => setTherapists(data.therapists));
  }, [step, branchId, serviceId]);

  useEffect(() => {
    if (step !== "datetime" || !branchId || !serviceOptionId || !date) return;
    setSlots([]);
    setTime(null);
    const params = new URLSearchParams({ branchId, serviceOptionId, date });
    if (therapistId && therapistId !== "ANY") params.set("therapistId", therapistId);

    // Queried live from services/booking-core (Go), not src/lib/availability.ts — see Phase 2.
    fetch(`/api/book-now/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots));
  }, [step, branchId, serviceOptionId, date, therapistId]);

  async function handleSendOtp() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/book-now/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setStep("otp");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/book-now/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setPhoneToken(data.phoneToken);
      setStep("confirm");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!branchId || !serviceOptionId || !date || !time || !phoneToken) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/book-now/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          serviceOptionId,
          therapistId: therapistId === "ANY" ? null : therapistId,
          date,
          time,
          guestName: guestName.trim(),
          phone: phone.trim(),
          phoneToken,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setError(dict.bookNow.slotTakenDescription);
        setStep("datetime");
        return;
      }
      if (res.status === 401) {
        // phoneToken expired — send the guest back to re-verify rather than dead-ending here.
        setError(data.error ?? "กรุณายืนยันเบอร์โทรอีกครั้ง");
        setPhoneToken(null);
        setStep("otp");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }

      setBookingCode(data.code ?? null);
      setStep("done");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-success/20 bg-success-light p-6 text-center animate-slide-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-success-hover">{dict.bookNow.successTitle}</p>
        <p className="text-sm text-gray-600">{dict.bookNow.successDescription}</p>
        {bookingCode && (
          <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card px-5 py-3">
            <span className="text-xs text-text-secondary">{dict.bookNow.bookingCodeLabel}</span>
            <span className="text-2xl font-bold tracking-wide text-primary">{bookingCode}</span>
          </div>
        )}
        <Link href="/book-now/manage">
          <Button type="button" variant="outline">
            {dict.bookNow.manageMyBooking}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb step={step} dict={dict} />

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
            label: `${o.durationMinutes} ${dict.dashboard.minutesSuffix}`,
            sub: o.promoPrice
              ? `฿${o.promoPrice} (${dict.bookNow.summary.normalPricePrefix} ฿${o.price})`
              : `฿${o.price}`,
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
            { id: "ANY", label: dict.bookNow.anyTherapistLabel, sub: dict.bookNow.anyTherapistHint },
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
                  <span>{weekdayFormat.format(d)}</span>
                  <span className="font-medium">{dayFormat.format(d)}</span>
                </button>
              );
            })}
          </div>

          {date && (
            <div className="grid grid-cols-3 gap-2">
              {slots.length === 0 && (
                <p className="col-span-3 text-center text-sm text-text-secondary">{dict.bookNow.noSlotsToday}</p>
              )}
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    setTime(slot);
                    setStep("details");
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

      {step === "details" && (
        <div className="flex flex-col gap-4">
          <Field label={dict.bookNow.nameLabel} htmlFor="book-now-name" required>
            <Input
              id="book-now-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={dict.bookNow.namePlaceholder}
            />
          </Field>
          <Field label={dict.bookNow.phoneLabel} htmlFor="book-now-phone" required hint={dict.bookNow.phoneHint}>
            <Input
              id="book-now-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={dict.bookNow.phonePlaceholder}
            />
          </Field>

          {error && <Alert variant="danger">{error}</Alert>}

          <Button
            type="button"
            size="lg"
            fullWidth
            isLoading={isLoading}
            disabled={!guestName.trim() || !phone.trim()}
            onClick={handleSendOtp}
          >
            {isLoading ? dict.bookNow.sendingOtp : dict.bookNow.sendOtp}
          </Button>
        </div>
      )}

      {step === "otp" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {dict.bookNow.otpSentDescription} {phone.trim()}
          </p>
          <Field label={dict.bookNow.otpLabel} htmlFor="book-now-otp" required>
            <Input
              id="book-now-otp"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder={dict.bookNow.otpPlaceholder}
            />
          </Field>

          {error && <Alert variant="danger">{error}</Alert>}

          <Button type="button" size="lg" fullWidth isLoading={isLoading} disabled={otp.length !== 6} onClick={handleVerifyOtp}>
            {isLoading ? dict.bookNow.verifying : dict.bookNow.verifyOtp}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="font-medium text-text-secondary hover:text-primary" onClick={() => setStep("details")}>
              {dict.bookNow.changePhone}
            </button>
            <button type="button" className="font-medium text-primary hover:underline" onClick={handleSendOtp}>
              {dict.bookNow.resendOtp}
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && selectedBranch && selectedService && selectedOption && date && time && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
            <Row label={dict.bookNow.summary.branch} value={selectedBranch.name} />
            <Row
              label={dict.bookNow.summary.service}
              value={`${selectedService.name} (${selectedOption.durationMinutes} ${dict.dashboard.minutesSuffix})`}
            />
            <Row
              label={dict.bookNow.summary.therapist}
              value={selectedTherapist ? selectedTherapist.nickname : dict.bookNow.anyTherapistLabel}
            />
            <Row label={dict.bookNow.summary.date} value={dayFormat.format(new Date(date))} />
            <Row label={dict.bookNow.summary.time} value={time} />
            <Row label={dict.bookNow.summary.name} value={guestName.trim()} />
            <Row label={dict.bookNow.summary.phone} value={phone.trim()} />
            <Row
              label={dict.bookNow.summary.price}
              value={
                selectedOption.promoPrice
                  ? `฿${selectedOption.promoPrice} (${dict.bookNow.summary.normalPricePrefix} ฿${selectedOption.price})`
                  : `฿${selectedOption.price}`
              }
            />
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <Button type="button" size="lg" isLoading={isLoading} onClick={handleConfirm} fullWidth>
            {isLoading ? dict.bookNow.confirming : dict.bookNow.confirmBooking}
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
          {dict.bookNow.back}
        </button>
      )}
    </div>
  );
}

function goBack(step: Step, setStep: (s: Step) => void) {
  const idx = STEP_ORDER.indexOf(step);
  if (idx > 0) setStep(STEP_ORDER[idx - 1]);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

function Breadcrumb({ step, dict }: { step: Step; dict: Dictionary }) {
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
        {dict.bookNow.stepPrefix} {currentIndex + 1}/{STEP_ORDER.length} · {dict.bookNow.steps[step]}
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
