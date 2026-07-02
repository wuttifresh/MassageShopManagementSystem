"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addServiceOption } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3.5">
      <div className="flex items-center gap-2 text-sm">
        <Input
          type="number"
          min={1}
          placeholder="นาที"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          required
          className="w-24"
        />
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="ราคา"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" isLoading={isSubmitting}>
          + เพิ่ม
        </Button>
      </div>
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </form>
  );
}
