"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createService } from "../actions";

type OptionRow = { durationMinutes: string; price: string };

export function NewServiceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<OptionRow[]>([{ durationMinutes: "60", price: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(index: number, patch: Partial<OptionRow>) {
    setOptions((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addOptionRow() {
    setOptions((rows) => [...rows, { durationMinutes: "", price: "" }]);
  }

  function removeOptionRow(index: number) {
    setOptions((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await createService({ name, category, description, options });

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/services");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        ชื่อบริการ
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        หมวดหมู่ (ไม่บังคับ)
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        รายละเอียด (ไม่บังคับ)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">ระยะเวลาและราคา</legend>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              placeholder="นาที"
              value={option.durationMinutes}
              onChange={(e) => updateOption(index, { durationMinutes: e.target.value })}
              required
              className="w-20 rounded-lg border border-neutral-300 p-2"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="ราคา"
              value={option.price}
              onChange={(e) => updateOption(index, { price: e.target.value })}
              required
              className="flex-1 rounded-lg border border-neutral-300 p-2"
            />
            {options.length > 1 && (
              <button
                type="button"
                onClick={() => removeOptionRow(index)}
                className="text-red-500"
                aria-label="ลบ"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addOptionRow} className="self-start text-sm text-neutral-500">
          + เพิ่มระยะเวลา
        </button>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}
