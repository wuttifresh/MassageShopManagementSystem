"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/dashboard/customers?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร"
        className="flex-1 rounded-lg border border-neutral-300 p-2 text-sm"
      />
      <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
        ค้นหา
      </button>
    </form>
  );
}
