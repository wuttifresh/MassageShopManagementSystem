"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/i18n/locale-provider";
import type { Dictionary } from "@/i18n/get-dictionary";

type BookingSummary = {
  id: string;
  code: string;
  status: keyof Dictionary["bookingStatus"];
  startTime: string;
  endTime: string;
  branchId: string;
  branchName: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  therapistId: string | null;
  therapistNickname: string | null;
};

type View = "search" | "result" | "reschedule" | "rescheduled";

const CANCELLABLE_STATUSES: BookingSummary["status"][] = ["PENDING", "CONFIRMED"];
const STATUS_BADGE_VARIANT: Record<BookingSummary["status"], BadgeVariant> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  COMPLETED: "neutral",
  RESCHEDULED: "info",
};

const DAY_COUNT = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDays(count: number): Date[] {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Array.from({ length: count }, (_, i) => new Date(base.getTime() + i * 86_400_000));
}

export function ManageBooking() {
  const { dict, locale } = useTranslation();
  const intlLocale = locale === "th" ? "th-TH" : "en-US";
  const dateTimeFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }),
    [intlLocale]
  );
  const weekdayFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" }),
    [intlLocale]
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", timeZone: "UTC" }),
    [intlLocale]
  );

  const [view, setView] = useState<View>("search");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const [rescheduleDate, setRescheduleDate] = useState<string | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [newCode, setNewCode] = useState<string | null>(null);

  const days = useMemo(() => nextDays(DAY_COUNT), []);

  useEffect(() => {
    if (view !== "reschedule" || !booking || !rescheduleDate) return;
    setSlots([]);
    setRescheduleTime(null);
    const params = new URLSearchParams({
      branchId: booking.branchId,
      serviceId: booking.serviceId,
      date: rescheduleDate,
      durationMinutes: String(booking.durationMinutes),
    });
    if (booking.therapistId) params.set("therapistId", booking.therapistId);

    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots));
  }, [view, booking, rescheduleDate]);

  async function handleSearch() {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ code: code.trim(), phone: phone.trim() });
      const res = await fetch(`/api/book-now/bookings/lookup?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setBooking(data.booking);
      setView("result");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancel() {
    if (!booking) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/book-now/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setBooking({ ...booking, status: "CANCELLED" });
      setConfirmCancelOpen(false);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReschedule() {
    if (!booking || !rescheduleDate || !rescheduleTime) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/book-now/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), date: rescheduleDate, time: rescheduleTime }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setNewCode(data.code ?? null);
      setView("rescheduled");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }

  function resetToSearch() {
    setView("search");
    setBooking(null);
    setCode("");
    setPhone("");
    setError(null);
    setRescheduleDate(null);
    setRescheduleTime(null);
    setNewCode(null);
  }

  if (view === "search") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">{dict.bookNowManage.description}</p>
        <Field label={dict.bookNowManage.bookingCodeLabel} htmlFor="manage-code" required>
          <Input
            id="manage-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={dict.bookNowManage.bookingCodePlaceholder}
          />
        </Field>
        <Field label={dict.bookNowManage.phoneLabel} htmlFor="manage-phone" required>
          <Input
            id="manage-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={dict.bookNowManage.phonePlaceholder}
          />
        </Field>

        {error && <Alert variant="danger">{error}</Alert>}

        <Button type="button" size="lg" fullWidth isLoading={isLoading} disabled={!code.trim() || !phone.trim()} onClick={handleSearch}>
          {isLoading ? dict.bookNowManage.searching : dict.bookNowManage.search}
        </Button>
      </div>
    );
  }

  if (view === "rescheduled") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-success/20 bg-success-light p-6 text-center animate-slide-up">
        <p className="text-lg font-semibold text-success-hover">{dict.bookNowManage.rescheduleSuccess}</p>
        {newCode && (
          <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card px-5 py-3">
            <span className="text-xs text-text-secondary">{dict.bookNowManage.newBookingCodeLabel}</span>
            <span className="text-2xl font-bold tracking-wide text-primary">{newCode}</span>
          </div>
        )}
        <Button type="button" onClick={resetToSearch}>
          {dict.bookNowManage.backToSearch}
        </Button>
      </div>
    );
  }

  if (!booking) return null;

  if (view === "reschedule") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-900">{dict.bookNowManage.rescheduleTitle}</h2>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => {
            const value = isoDate(d);
            const selected = value === rescheduleDate;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRescheduleDate(value)}
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

        {rescheduleDate && (
          <div className="grid grid-cols-3 gap-2">
            {slots.length === 0 && (
              <p className="col-span-3 text-center text-sm text-text-secondary">{dict.bookNow.noSlotsToday}</p>
            )}
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setRescheduleTime(slot)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-medium transition-colors",
                  slot === rescheduleTime
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card text-gray-700 hover:border-primary hover:bg-primary-light hover:text-primary"
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        <Button type="button" size="lg" fullWidth isLoading={isLoading} disabled={!rescheduleTime} onClick={handleReschedule}>
          {isLoading ? dict.bookNowManage.rescheduling : dict.bookNowManage.confirmReschedule}
        </Button>
        <button
          type="button"
          className="text-sm font-medium text-text-secondary hover:text-primary"
          onClick={() => setView("result")}
        >
          {dict.bookNow.back}
        </button>
      </div>
    );
  }

  const canManage = CANCELLABLE_STATUSES.includes(booking.status);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title={booking.code}
          action={<Badge variant={STATUS_BADGE_VARIANT[booking.status]}>{dict.bookingStatus[booking.status]}</Badge>}
        />
        <div className="flex flex-col gap-2 text-sm">
          <Row label={dict.bookNowManage.branchLabel} value={booking.branchName} />
          <Row label={dict.bookNowManage.serviceLabel} value={`${booking.serviceName} (${booking.durationMinutes} ${dict.dashboard.minutesSuffix})`} />
          <Row label={dict.bookNowManage.therapistLabel} value={booking.therapistNickname ?? dict.bookNow.anyTherapistLabel} />
          <Row label={dict.bookNowManage.dateTimeLabel} value={dateTimeFormat.format(new Date(booking.startTime))} />
        </div>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {canManage && (
        <div className="flex flex-col gap-2">
          <Button type="button" fullWidth onClick={() => setView("reschedule")}>
            {dict.bookNowManage.rescheduleButton}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-danger/30 text-danger hover:bg-danger-light"
            fullWidth
            onClick={() => setConfirmCancelOpen(true)}
          >
            {dict.bookNowManage.cancelButton}
          </Button>
        </div>
      )}

      <button type="button" className="text-sm font-medium text-text-secondary hover:text-primary" onClick={resetToSearch}>
        {dict.bookNowManage.backToSearch}
      </button>

      <ConfirmDialog
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={handleCancel}
        title={dict.bookNowManage.confirmCancelTitle}
        description={dict.bookNowManage.confirmCancelDescription}
        confirmLabel={dict.bookNowManage.confirmCancelLabel}
        isLoading={isLoading}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}
