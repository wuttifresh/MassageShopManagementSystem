"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createStaff } from "../actions";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        ชื่อ
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        อีเมล
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        สาขาที่ประจำ
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          required
          className="rounded-lg border border-neutral-300 p-2"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

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
