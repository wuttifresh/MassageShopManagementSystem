"use client";

import { useState, useTransition } from "react";
import { voidTransaction } from "./actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function VoidTransactionButton({ transactionId }: { transactionId: string }) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm(reason?: string) {
    if (!reason?.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await voidTransaction(transactionId, reason);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      showToast({ variant: "success", title: "ยกเลิกใบเสร็จแล้ว" });
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="text-danger" onClick={() => setOpen(true)}>
        ยกเลิกใบเสร็จ
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="ยกเลิกใบเสร็จนี้?"
        description="กรุณาระบุเหตุผลที่ยกเลิกใบเสร็จนี้ การกระทำนี้ไม่สามารถย้อนกลับได้"
        confirmLabel="ยืนยันยกเลิก"
        requireReason
        reasonLabel="เหตุผลที่ยกเลิก"
        isLoading={isPending}
      />
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </>
  );
}
