"use client";

import { useState, useTransition } from "react";
import { voidTransaction } from "./actions";

export function VoidTransactionButton({ transactionId }: { transactionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const reason = prompt("เหตุผลที่ยกเลิกใบเสร็จนี้:");
    if (!reason || !reason.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await voidTransaction(transactionId, reason);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50"
      >
        {isPending ? "กำลังยกเลิก..." : "ยกเลิกใบเสร็จ"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
