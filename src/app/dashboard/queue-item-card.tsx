"use client";

import { useState, useTransition } from "react";
import { assignTherapist, cancelQueue, completeService, startService } from "./actions";

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

const STATUS_LABEL: Record<string, string> = {
  WAITING: "รอมอบหมาย",
  ASSIGNED: "มอบหมายแล้ว",
  IN_PROGRESS: "กำลังนวด",
  DONE: "เสร็จแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

const STATUS_COLOR: Record<string, string> = {
  WAITING: "bg-amber-100 text-amber-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-green-100 text-green-700",
  DONE: "bg-neutral-100 text-neutral-500",
  CANCELLED: "bg-red-100 text-red-500",
};

export function QueueItemCard({
  queue,
  therapistOptions,
}: {
  queue: QueueItem;
  therapistOptions: TherapistOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedTherapistId, setPickedTherapistId] = useState(queue.therapistId ?? "");
  const [bedLabel, setBedLabel] = useState(queue.bedLabel ?? "");

  const isActive = queue.status === "WAITING" || queue.status === "ASSIGNED" || queue.status === "IN_PROGRESS";

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success && result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {queue.queueNumber} · {queue.customer?.name ?? queue.guestName ?? "ลูกค้า"}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[queue.status] ?? ""}`}>
          {STATUS_LABEL[queue.status] ?? queue.status}
        </span>
      </div>
      <p className="text-neutral-500">
        {queue.serviceOption.service.name} ({queue.serviceOption.durationMinutes} นาที)
        {queue.bedLabel ? ` · เตียง ${queue.bedLabel}` : ""}
      </p>

      {queue.status === "WAITING" && (
        <div className="flex gap-2">
          <select
            value={pickedTherapistId}
            onChange={(e) => setPickedTherapistId(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-300 p-2 text-sm"
          >
            <option value="">เลือกหมอนวด</option>
            {therapistOptions.map((t) => (
              <option key={t.id} value={t.id} disabled={t.busy}>
                {t.nickname} {t.busy ? "(กำลังนวดอยู่)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !pickedTherapistId}
            onClick={() => run(() => assignTherapist(queue.id, pickedTherapistId))}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
          >
            มอบหมาย
          </button>
        </div>
      )}

      {queue.status === "ASSIGNED" && (
        <div className="flex gap-2">
          <span className="flex-1 rounded-lg border border-neutral-200 p-2 text-neutral-500">
            หมอนวด: {queue.therapist?.nickname}
          </span>
          <input
            value={bedLabel}
            onChange={(e) => setBedLabel(e.target.value)}
            placeholder="เตียง"
            className="w-20 rounded-lg border border-neutral-300 p-2"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => startService(queue.id, bedLabel))}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
          >
            เริ่มนวด
          </button>
        </div>
      )}

      {queue.status === "IN_PROGRESS" && (
        <div className="flex gap-2">
          <span className="flex-1 rounded-lg border border-neutral-200 p-2 text-neutral-500">
            หมอนวด: {queue.therapist?.nickname}
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => completeService(queue.id))}
            className="rounded-lg bg-green-600 px-3 py-2 text-white disabled:opacity-50"
          >
            เช็คเอาท์ (เสร็จ)
          </button>
        </div>
      )}

      {isActive && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => cancelQueue(queue.id))}
          className="self-start text-xs text-red-500 disabled:opacity-50"
        >
          ยกเลิกคิว
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
