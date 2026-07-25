"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProduct } from "../actions";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function NewProductForm({ branchId }: { branchId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await createProduct({ branchId, name, price, stockQuantity });

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/products");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="ชื่อสินค้า" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="ราคา (บาท)" required>
        <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
      </Field>

      <Field label="จำนวนสต๊อกเริ่มต้น" required>
        <Input
          type="number"
          min={0}
          step="1"
          value={stockQuantity}
          onChange={(e) => setStockQuantity(e.target.value)}
          required
        />
      </Field>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
