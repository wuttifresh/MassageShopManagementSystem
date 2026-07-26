"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTimeBlock, deleteTimeBlock } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export type TimeBlockRow = {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  reason: string | null;
};

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TimeBlockManager({ therapistId, initialBlocks }: { therapistId: string; initialBlocks: TimeBlockRow[] }) {
  const router = useRouter();
  const [date, setDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setIsSaving(true);
    setError(null);
    const result = await createTimeBlock(therapistId, date, startTime, endTime, reason);
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setReason("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const result = await deleteTimeBlock(therapistId, id);
    setDeletingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="บล็อกเวลา" description="กันเวลาไม่ให้ลูกค้าจองทับ เช่น พักเที่ยง หรือติดนัดส่วนตัว" />

      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="py-1.5" />
          <Input
            type="text"
            placeholder="เหตุผล (ไม่บังคับ)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="py-1.5"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="py-1.5" />
          <span className="text-text-secondary">ถึง</span>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="py-1.5" />
          <Button type="button" size="sm" isLoading={isSaving} onClick={handleAdd}>
            เพิ่ม
          </Button>
        </div>
        {error && <span className="text-xs font-medium text-danger">{error}</span>}
      </div>

      {initialBlocks.length === 0 ? (
        <EmptyState icon="🗓️" title="ยังไม่มีช่วงเวลาที่บล็อก" className="mt-2" />
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {initialBlocks.map((block) => (
            <li
              key={block.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">
                  {DATE_FORMAT.format(new Date(block.date))} · {block.startTime}–{block.endTime}
                </span>
                {block.reason && <span className="text-xs text-text-secondary">{block.reason}</span>}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                isLoading={deletingId === block.id}
                onClick={() => handleDelete(block.id)}
              >
                ลบ
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
