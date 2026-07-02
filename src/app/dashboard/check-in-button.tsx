"use client";

import { useState, useTransition } from "react";
import { checkInBooking } from "./actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useTranslation } from "@/i18n/locale-provider";

type TherapistOption = { id: string; nickname: string; busy: boolean };

export function CheckInButton({
  bookingId,
  therapistOptions,
  initialTherapistId,
}: {
  bookingId: string;
  therapistOptions: TherapistOption[];
  initialTherapistId?: string | null;
}) {
  const { dict } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState(initialTherapistId ?? "");

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await checkInBooking(bookingId, therapistId || null);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex w-full flex-col items-end gap-1.5 sm:w-auto">
      <div className="flex w-full gap-2 sm:w-auto">
        {therapistOptions.length > 0 ? (
          <Select
            value={therapistId}
            onChange={(e) => setTherapistId(e.target.value)}
            className="w-full py-2 text-xs sm:w-40"
            aria-label={dict.walkIn.selectTherapist}
          >
            <option value="">{dict.dashboard.assignLater}</option>
            {therapistOptions.map((t) => (
              <option key={t.id} value={t.id} disabled={t.busy}>
                {t.nickname} {t.busy ? dict.queue.busySuffix : ""}
              </option>
            ))}
          </Select>
        ) : (
          <span className="flex-1 self-center text-xs text-text-secondary sm:flex-none">
            {dict.dashboard.noActiveTherapistShort}
          </span>
        )}
        <Button type="button" size="sm" variant="secondary" isLoading={isPending} onClick={handleClick}>
          {dict.dashboard.checkIn}
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
