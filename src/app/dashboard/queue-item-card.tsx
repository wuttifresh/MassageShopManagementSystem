"use client";

import { useState, useTransition } from "react";
import { assignTherapist, cancelQueue, completeService, startService } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n/locale-provider";

type TherapistOption = { id: string; nickname: string; busy: boolean };

type QueueItem = {
  id: string;
  queueNumber: string;
  status: string;
  bedLabel: string | null;
  therapistId: string | null;
  therapist: { nickname: string } | null;
  customer: { name: string } | null;
  guestName: string | null;
  serviceOption: { durationMinutes: number; service: { name: string } };
};

const STATUS_BADGE: Record<string, BadgeVariant> = {
  WAITING: "warning",
  ASSIGNED: "info",
  IN_PROGRESS: "success",
  DONE: "neutral",
  CANCELLED: "danger",
};

export function QueueItemCard({
  queue,
  therapistOptions,
}: {
  queue: QueueItem;
  therapistOptions: TherapistOption[];
}) {
  const { dict } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedTherapistId, setPickedTherapistId] = useState(queue.therapistId ?? "");
  const [bedLabel, setBedLabel] = useState(queue.bedLabel ?? "");

  const isActive = queue.status === "WAITING" || queue.status === "ASSIGNED" || queue.status === "IN_PROGRESS";
  const statusLabel = dict.queueStatus[queue.status as keyof typeof dict.queueStatus] ?? queue.status;

  function run(action: () => Promise<{ success: boolean; error?: string }>, onError?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success && result.error) {
        setError(result.error);
        onError?.();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-gray-50/60 p-3.5 text-sm transition-colors hover:border-gray-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-gray-900">
          {queue.queueNumber} · {queue.customer?.name ?? queue.guestName ?? dict.common.customerFallback}
        </span>
        <Badge variant={STATUS_BADGE[queue.status] ?? "neutral"}>{statusLabel}</Badge>
      </div>
      <p className="text-text-secondary">
        {queue.serviceOption.service.name} ({queue.serviceOption.durationMinutes} {dict.dashboard.minutesSuffix})
        {queue.bedLabel ? ` · ${dict.queue.bedPlaceholder} ${queue.bedLabel}` : ""}
      </p>

      {queue.status === "WAITING" && (
        therapistOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <Select
              value={pickedTherapistId}
              disabled={isPending}
              onChange={(e) => {
                const nextTherapistId = e.target.value;
                setPickedTherapistId(nextTherapistId);
                // Assign as soon as a therapist is picked, rather than requiring a second tap on
                // a separate "assign" button — on touch devices, the first tap after closing a
                // native <select> picker often just dismisses it instead of hitting the button
                // next to it, which reads as "the button doesn't work".
                if (nextTherapistId) {
                  run(
                    () => assignTherapist(queue.id, nextTherapistId),
                    () => setPickedTherapistId("")
                  );
                }
              }}
              className="flex-1 bg-card"
            >
              <option value="">{dict.walkIn.selectTherapist}</option>
              {therapistOptions.map((t) => (
                <option key={t.id} value={t.id} disabled={t.busy}>
                  {t.nickname} {t.busy ? dict.queue.busySuffix : ""}
                </option>
              ))}
            </Select>
            {isPending && (
              <svg className="h-5 w-5 shrink-0 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card px-3.5 py-2.5 text-text-secondary">
            {dict.dashboard.noActiveTherapist}
          </p>
        )
      )}

      {queue.status === "ASSIGNED" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <span className="flex flex-1 items-center rounded-xl border border-border bg-card px-3.5 py-2.5 text-text-secondary">
            {dict.dashboard.therapistPrefix}: {queue.therapist?.nickname}
          </span>
          <Input
            value={bedLabel}
            onChange={(e) => setBedLabel(e.target.value)}
            placeholder={dict.queue.bedPlaceholder}
            className="sm:w-24"
          />
          <Button type="button" variant="secondary" isLoading={isPending} onClick={() => run(() => startService(queue.id, bedLabel))}>
            {dict.queue.startService}
          </Button>
        </div>
      )}

      {queue.status === "IN_PROGRESS" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <span className="flex flex-1 items-center rounded-xl border border-border bg-card px-3.5 py-2.5 text-text-secondary">
            {dict.dashboard.therapistPrefix}: {queue.therapist?.nickname}
          </span>
          <Button type="button" variant="success" isLoading={isPending} onClick={() => run(() => completeService(queue.id))}>
            {dict.queue.checkout}
          </Button>
        </div>
      )}

      {isActive && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => cancelQueue(queue.id))}
          className="self-start text-xs font-medium text-danger transition-colors hover:text-danger-hover disabled:opacity-50"
        >
          {dict.queue.cancelQueue}
        </button>
      )}

      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
