"use client";

import { signOut } from "next-auth/react";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/i18n/locale-provider";

export function SignOutButton({ className }: { className?: string }) {
  const { dict } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-danger/30 hover:bg-danger-light hover:text-danger",
        className
      )}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15" />
      </svg>
      {dict.common.signOut}
    </button>
  );
}
