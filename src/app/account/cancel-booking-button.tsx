"use client";

import { useState, useTransition } from "react";
import { cancelBooking } from "./actions";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("ยืนยันการยกเลิกการจองนี้?")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelBooking(bookingId);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="w-full rounded-lg border border-red-300 py-2 text-sm text-red-600 disabled:opacity-50"
      >
        {isPending ? "กำลังยกเลิก..." : "ยกเลิก"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
