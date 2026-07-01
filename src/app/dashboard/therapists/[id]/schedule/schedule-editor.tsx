"use client";

import { useState } from "react";
import { upsertScheduleDay } from "./actions";

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
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{DATE_FORMAT.format(new Date(row.date))}</span>
        <select
          value={row.status}
          onChange={(e) => setRow((r) => ({ ...r, status: e.target.value as ScheduleStatus }))}
          className="rounded-lg border border-neutral-300 p-1 text-sm"
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {row.status === "WORKING" && (
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={row.startTime}
            onChange={(e) => setRow((r) => ({ ...r, startTime: e.target.value }))}
            className="rounded-lg border border-neutral-300 p-1"
          />
          <span>ถึง</span>
          <input
            type="time"
            value={row.endTime}
            onChange={(e) => setRow((r) => ({ ...r, endTime: e.target.value }))}
            className="rounded-lg border border-neutral-300 p-1"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {isSaving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        {savedAt && <span className="text-xs text-green-600">บันทึกแล้ว</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

export function ScheduleEditor({ therapistId, initialDays }: { therapistId: string; initialDays: DayRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {initialDays.map((day) => (
        <Row key={day.date} initial={day} therapistId={therapistId} />
      ))}
    </div>
  );
}
