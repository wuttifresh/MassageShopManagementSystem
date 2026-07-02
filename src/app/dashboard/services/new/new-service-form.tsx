"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createService } from "../actions";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="ชื่อบริการ" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="หมวดหมู่" hint="ไม่บังคับ">
        <Input value={category} onChange={(e) => setCategory(e.target.value)} />
      </Field>

      <Field label="รายละเอียด" hint="ไม่บังคับ">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-700">ระยะเวลาและราคา</legend>
        <div className="flex flex-col gap-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="นาที"
                value={option.durationMinutes}
                onChange={(e) => updateOption(index, { durationMinutes: e.target.value })}
                required
                className="w-24"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="ราคา"
                value={option.price}
                onChange={(e) => updateOption(index, { price: e.target.value })}
                required
                className="flex-1"
              />
              {options.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeOptionRow(index)}
                  className="shrink-0 rounded-lg p-2 text-danger hover:bg-danger-light"
                  aria-label="ลบ"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOptionRow}
          className="self-start text-sm font-medium text-primary hover:text-primary-hover"
        >
          + เพิ่มระยะเวลา
        </button>
      </fieldset>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
