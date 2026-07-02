"use client";

import { useState, useTransition } from "react";
import { checkInBooking } from "./actions";
import { Button } from "@/components/ui/button";

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
      <Button type="button" size="sm" variant="secondary" isLoading={isPending} onClick={handleClick}>
        เช็คอิน
      </Button>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
