"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 p-0 backdrop-blur-[1px] animate-fade-in sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "w-full max-w-sm animate-slide-up rounded-t-2xl border border-border bg-card p-5 shadow-dropdown sm:rounded-2xl",
          className
        )}
      >
        <h2 id="modal-title" className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
