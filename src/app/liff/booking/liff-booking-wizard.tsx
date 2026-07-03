"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/i18n/locale-provider";
import type { Dictionary } from "@/i18n/get-dictionary";

type Branch = { id: string; name: string; address: string | null };
type ServiceOption = { id: string; durationMinutes: number; price: string; promoPrice: string | null };
type Service = { id: string; name: string; options: ServiceOption[] };
// Flattened (service, option) pair — Phase 3's flow has a single "choose service" step, unlike
// the web wizard's separate service/duration steps, since each service here usually has 1-2
// duration options and combining them keeps the mobile LIFF flow to the phases the spec lists.
type ServiceOptionChoice = { serviceOptionId: string; label: string; sub: string };

type Step = "branch" | "service" | "datetime" | "details" | "confirm" | "done";
type InitState = "loading" | "ready" | "error";

const DAY_COUNT = 14;
const STEP_ORDER: Step[] = ["branch", "service", "datetime", "details", "confirm"];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDays(count: number): Date[] {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Array.from({ length: count }, (_, i) => new Date(base.getTime() + i * 86_400_000));
}

export function LiffBookingWizard() {
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

  const [initState, setInitState] = useState<InitState>("loading");
  const [idToken, setIdToken] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("branch");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<string[]>([]);

  const [branchId, setBranchId] = useState<string | null>(null);
  const [serviceOptionId, setServiceOptionId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotJustTaken, setSlotJustTaken] = useState(false);
  const [bookingCode, setBookingCode] = useState<string | null>(null);

  const days = useMemo(() => nextDays(DAY_COUNT), []);
  const choices: ServiceOptionChoice[] = useMemo(
    () =>
      services.flatMap((s) =>
        s.options.map((o) => ({
          serviceOptionId: o.id,
          label: `${s.name} (${o.durationMinutes} ${dict.dashboard.minutesSuffix})`,
          sub: o.promoPrice
            ? `฿${o.promoPrice} (${dict.liffBooking.summary.normalPricePrefix} ฿${o.price})`
            : `฿${o.price}`,
        }))
      ),
    [services, dict]
  );
  const selectedChoice = choices.find((c) => c.serviceOptionId === serviceOptionId) ?? null;
  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;

  // liff.init + auto login. Deferred to a dynamic import so the LIFF SDK (which touches
  // window/navigator) is never evaluated during SSR — only ever inside this client-side effect.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        console.error("[liff-booking] NEXT_PUBLIC_LIFF_ID is not configured");
        if (!cancelled) setInitState("error");
        return;
      }

      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return; // navigates away to LINE login; this component unmounts
        }

        const token = liff.getIDToken();
        if (!token) {
          // Missing ID token almost always means the LIFF app's "openid"/ID token scope isn't
          // enabled in the LINE Developers console yet — a manual setup step, not a runtime bug.
          console.error("[liff-booking] liff.getIDToken() returned null — check the LIFF app's ID token scope");
          if (!cancelled) setInitState("error");
          return;
        }

        const profile = await liff.getProfile();
        if (cancelled) return;

        setIdToken(token);
        setName((current) => current || profile.displayName || "");
        setInitState("ready");
      } catch (err) {
        console.error("[liff-booking] init failed", err);
        if (!cancelled) setInitState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Step 1: load branches, auto-skip if there's only one.
  useEffect(() => {
    if (initState !== "ready") return;
    fetch("/api/bookings?meta=branches")
      .then((r) => r.json())
      .then((data: { branches: Branch[] }) => {
        setBranches(data.branches);
        if (data.branches.length === 1) {
          setBranchId(data.branches[0].id);
          setStep("service");
        }
      });
  }, [initState]);

  // Step 2: load services once a branch is chosen.
  useEffect(() => {
    if (step !== "service" || services.length > 0) return;
    fetch("/api/bookings?meta=services")
      .then((r) => r.json())
      .then((data: { services: Service[] }) => setServices(data.services));
  }, [step, services.length]);

  // Step 3: load available slots whenever date changes (always "any available therapist").
  useEffect(() => {
    if (step !== "datetime" || !branchId || !serviceOptionId || !date) return;
    setSlots([]);
    setTime(null);
    const params = new URLSearchParams({ branchId, serviceOptionId, date });

    fetch(`/api/bookings?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots ?? []));
  }, [step, branchId, serviceOptionId, date]);

  function refreshSlots() {
    if (!branchId || !serviceOptionId || !date) return;
    const params = new URLSearchParams({ branchId, serviceOptionId, date });
    fetch(`/api/bookings?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots ?? []));
  }

  async function handleConfirm() {
    if (!branchId || !serviceOptionId || !date || !time || !idToken) return;
    setIsLoading(true);
    setError(null);
    setSlotJustTaken(false);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          channel: "LINE",
          branchId,
          serviceOptionId,
          date,
          time,
          name: name.trim(),
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setSlotJustTaken(true);
        setStep("datetime");
        refreshSlots();
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

  if (initState === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Skeleton className="h-10 w-10 rounded-full" />
        <p className="text-sm text-text-secondary">{dict.liffBooking.initializing}</p>
      </div>
    );
  }

  if (initState === "error") {
    return <Alert variant="danger">{dict.liffBooking.initError}</Alert>;
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-success/20 bg-success-light p-6 text-center animate-slide-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-success-hover">{dict.liffBooking.successTitle}</p>
        <p className="text-sm text-gray-600">{dict.liffBooking.successDescription}</p>
        {bookingCode && (
          <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card px-5 py-3">
            <span className="text-xs text-text-secondary">{dict.liffBooking.bookingCodeLabel}</span>
            <span className="text-2xl font-bold tracking-wide text-primary">{bookingCode}</span>
          </div>
        )}
        <Button
          type="button"
          onClick={() => {
            import("@line/liff").then(({ default: liff }) => liff.closeWindow());
          }}
        >
          {dict.liffBooking.closeWindow}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb step={step} dict={dict} />

      {slotJustTaken && (
        <Alert variant="warning" title={dict.liffBooking.slotTakenTitle}>
          {dict.liffBooking.slotTakenDescription}
        </Alert>
      )}

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
          items={choices.map((c) => ({ id: c.serviceOptionId, label: c.label, sub: c.sub }))}
          onSelect={(id) => {
            setServiceOptionId(id);
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
                <p className="col-span-3 text-center text-sm text-text-secondary">{dict.liffBooking.noSlotsToday}</p>
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
          <Field label={dict.liffBooking.nameLabel} htmlFor="liff-name" required>
            <Input
              id="liff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={dict.liffBooking.namePlaceholder}
            />
          </Field>
          <Field label={dict.liffBooking.phoneLabel} htmlFor="liff-phone">
            <Input
              id="liff-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={dict.liffBooking.phonePlaceholder}
            />
          </Field>
          <Button type="button" size="lg" fullWidth disabled={!name.trim()} onClick={() => setStep("confirm")}>
            {dict.liffBooking.continue}
          </Button>
        </div>
      )}

      {step === "confirm" && selectedBranch && selectedChoice && date && time && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 text-sm shadow-card">
            <Row label={dict.liffBooking.summary.branch} value={selectedBranch.name} />
            <Row label={dict.liffBooking.summary.service} value={selectedChoice.label} />
            <Row label={dict.liffBooking.summary.date} value={dayFormat.format(new Date(date))} />
            <Row label={dict.liffBooking.summary.time} value={time} />
            <Row label={dict.liffBooking.summary.price} value={selectedChoice.sub} />
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <Button type="button" size="lg" isLoading={isLoading} onClick={handleConfirm} fullWidth>
            {isLoading ? dict.liffBooking.confirming : dict.liffBooking.confirmBooking}
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
          {dict.liffBooking.back}
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
        {dict.liffBooking.stepPrefix} {currentIndex + 1}/{STEP_ORDER.length} · {dict.liffBooking.steps[step]}
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
