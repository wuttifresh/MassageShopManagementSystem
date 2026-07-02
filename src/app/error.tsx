"use client";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/locale-provider";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { dict } = useTranslation();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <p className="text-4xl">😥</p>
      <h1 className="text-lg font-semibold text-gray-900">{dict.error.title}</h1>
      <p className="text-sm text-text-secondary">{dict.error.description}</p>
      {error.digest && (
        <p className="text-xs text-gray-400">
          {dict.error.refCode}: {error.digest}
        </p>
      )}
      <Button onClick={reset}>{dict.error.retry}</Button>
    </main>
  );
}
