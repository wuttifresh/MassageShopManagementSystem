"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addServiceOption } from "../actions";

export function AddOptionForm({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [durationMinutes, setDurationMinutes] = useState("");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await addServiceOption(serviceId, { durationMinutes, price });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDurationMinutes("");
    setPrice("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 text-sm">
      <input
        type="number"
        min={1}
        placeholder="นาที"
        value={durationMinutes}
        onChange={(e) => setDurationMinutes(e.target.value)}
        required
        className="w-20 rounded-lg border border-neutral-300 p-2"
      />
      <input
        type="number"
        min={0}
        step="0.01"
        placeholder="ราคา"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
        className="flex-1 rounded-lg border border-neutral-300 p-2"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
      >
        + เพิ่ม
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
