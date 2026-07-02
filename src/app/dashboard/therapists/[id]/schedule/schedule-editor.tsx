"use client";

import { useState } from "react";
import { upsertScheduleDay } from "./actions";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ScheduleStatus = "WORKING" | "DAY_OFF" | "LEAVE";

type DayRow = {
  date: string;
  status: ScheduleStatus;
  startTime: string;
  endTime: string;
};

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  WORKING: "ทำงาน",
  DAY_OFF: "วันหยุด",
  LEAVE: "ลา",
};

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function Row({ initial, therapistId }: { initial: DayRow; therapistId: string }) {
  const [row, setRow] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    const result = await upsertScheduleDay(
      therapistId,
      row.date,
      row.status,
      row.status === "WORKING" ? row.startTime : null,
      row.status === "WORKING" ? row.endTime : null
    );
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900">{DATE_FORMAT.format(new Date(row.date))}</span>
        <Select
          value={row.status}
          onChange={(e) => setRow((r) => ({ ...r, status: e.target.value as ScheduleStatus }))}
          className="w-auto py-1.5"
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {row.status === "WORKING" && (
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={row.startTime}
            onChange={(e) => setRow((r) => ({ ...r, startTime: e.target.value }))}
            className="py-1.5"
          />
          <span className="text-text-secondary">ถึง</span>
          <Input
            type="time"
            value={row.endTime}
            onChange={(e) => setRow((r) => ({ ...r, endTime: e.target.value }))}
            className="py-1.5"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" isLoading={isSaving} onClick={handleSave}>
          บันทึก
        </Button>
        {savedAt && <Badge variant="success">บันทึกแล้ว</Badge>}
        {error && <span className="text-xs font-medium text-danger">{error}</span>}
      </div>
    </div>
  );
}

export function ScheduleEditor({ therapistId, initialDays }: { therapistId: string; initialDays: DayRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {initialDays.map((day) => (
        <Row key={day.date} initial={day} therapistId={therapistId} />
      ))}
    </div>
  );
}
