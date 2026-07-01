"use client";

import { useState, useTransition } from "react";
import { checkInBooking } from "./actions";

export function CheckInButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await checkInBooking(bookingId);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "กำลังเช็คอิน..." : "เช็คอิน"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
