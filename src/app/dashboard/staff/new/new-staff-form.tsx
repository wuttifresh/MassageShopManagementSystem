"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createStaff } from "../actions";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Branch = { id: string; name: string };

export function NewStaffForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await createStaff({ name, email, password, branchId });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/staff");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="ชื่อ" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="อีเมล" required>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>

      <Field label="รหัสผ่าน" required hint="อย่างน้อย 8 ตัวอักษร">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </Field>

      <Field label="สาขาที่ประจำ" required>
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        บันทึก
      </Button>
    </form>
  );
}
