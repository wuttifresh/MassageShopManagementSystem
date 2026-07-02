"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rescheduleBooking } from "@/app/account/actions";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/i18n/locale-provider";

const DAY_COUNT = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDays(count: number): Date[] {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Array.from({ length: count }, (_, i) => new Date(base.getTime() + i * 86_400_000));
}

export function ReschedulePicker({
  bookingId,
  branchId,
  serviceId,
  durationMinutes,
  therapistId,
}: {
  bookingId: string;
  branchId: string;
  serviceId: string;
  durationMinutes: number;
  therapistId: string | null;
}) {
  const router = useRouter();
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
  const days = useMemo(() => nextDays(DAY_COUNT), []);

  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    setSlots([]);
    const params = new URLSearchParams({
      branchId,
      serviceId,
      date,
      durationMinutes: String(durationMinutes),
    });
    if (therapistId) params.set("therapistId", therapistId);

    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots));
  }, [date, branchId, serviceId, durationMinutes, therapistId]);

  async function handlePick(time: string) {
    if (!date) return;
    setIsSubmitting(true);
    setError(null);

    const result = await rescheduleBooking(bookingId, date, time);

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/account");
  }

  return (
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
            <p className="col-span-3 text-center text-sm text-text-secondary">{dict.book.noSlotsToday}</p>
          )}
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              disabled={isSubmitting}
              onClick={() => handlePick(slot)}
              className="rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:bg-primary-light hover:text-primary disabled:opacity-50"
            >
              {slot}
            </button>
          ))}
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}
