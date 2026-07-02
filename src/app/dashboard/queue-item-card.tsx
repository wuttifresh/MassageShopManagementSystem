"use client";

import { useState, useTransition } from "react";
import { assignTherapist, cancelQueue, completeService, startService } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/input";

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
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-gray-50/60 p-3.5 text-sm transition-colors hover:border-gray-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-gray-900">
          {queue.queueNumber} · {queue.customer?.name ?? queue.guestName ?? "ลูกค้า"}
        </span>
        <Badge variant={STATUS_BADGE[queue.status] ?? "neutral"}>{STATUS_LABEL[queue.status] ?? queue.status}</Badge>
      </div>
      <p className="text-text-secondary">
        {queue.serviceOption.service.name} ({queue.serviceOption.durationMinutes} นาที)
        {queue.bedLabel ? ` · เตียง ${queue.bedLabel}` : ""}
      </p>

      {queue.status === "WAITING" && (
        therapistOptions.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={pickedTherapistId}
              onChange={(e) => setPickedTherapistId(e.target.value)}
              className="flex-1 bg-card"
            >
              <option value="">เลือกหมอนวด</option>
              {therapistOptions.map((t) => (
                <option key={t.id} value={t.id} disabled={t.busy}>
                  {t.nickname} {t.busy ? "(กำลังนวดอยู่)" : ""}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              disabled={!pickedTherapistId}
              isLoading={isPending}
              onClick={() => run(() => assignTherapist(queue.id, pickedTherapistId))}
            >
              มอบหมาย
            </Button>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card px-3.5 py-2.5 text-text-secondary">
            ยังไม่มีหมอนวดพร้อมทำงานในสาขานี้ — เพิ่มหมอนวดหรือตั้งสถานะ &quot;พร้อมทำงาน&quot; ก่อน
          </p>
        )
      )}

      {queue.status === "ASSIGNED" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <span className="flex flex-1 items-center rounded-xl border border-border bg-card px-3.5 py-2.5 text-text-secondary">
            หมอนวด: {queue.therapist?.nickname}
          </span>
          <Input
            value={bedLabel}
            onChange={(e) => setBedLabel(e.target.value)}
            placeholder="เตียง"
            className="sm:w-24"
          />
          <Button type="button" variant="secondary" isLoading={isPending} onClick={() => run(() => startService(queue.id, bedLabel))}>
            เริ่มนวด
          </Button>
        </div>
      )}

      {queue.status === "IN_PROGRESS" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <span className="flex flex-1 items-center rounded-xl border border-border bg-card px-3.5 py-2.5 text-text-secondary">
            หมอนวด: {queue.therapist?.nickname}
          </span>
          <Button type="button" variant="success" isLoading={isPending} onClick={() => run(() => completeService(queue.id))}>
            เช็คเอาท์ (เสร็จ)
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
          ยกเลิกคิว
        </button>
      )}

      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
