"use client";

import { useState, useTransition } from "react";
import { cancelBooking } from "./actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslation } from "@/i18n/locale-provider";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const { dict } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelBooking(bookingId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <Button type="button" variant="outline" className="border-danger/30 text-danger hover:bg-danger-light" fullWidth onClick={() => setOpen(true)}>
        {dict.account.cancelBooking}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={dict.account.confirmCancelTitle}
        description={dict.account.confirmCancelDescription}
        confirmLabel={dict.account.confirmCancelLabel}
        isLoading={isPending}
      />
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
