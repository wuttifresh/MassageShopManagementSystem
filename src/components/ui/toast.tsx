"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { AlertVariant } from "./alert";

type Toast = { id: number; variant: AlertVariant; title: string; description?: string };

type ToastContextValue = {
  showToast: (toast: { variant?: AlertVariant; title: string; description?: string }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<AlertVariant, string> = {
  info: "border-primary/20 bg-white text-gray-900 before:bg-primary",
  success: "border-success/20 bg-white text-gray-900 before:bg-success",
  warning: "border-warning/20 bg-white text-gray-900 before:bg-warning",
  danger: "border-danger/20 bg-white text-gray-900 before:bg-danger",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback<ToastContextValue["showToast"]>(({ variant = "info", title, description }) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((prev) => [...prev, { id, variant, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto relative w-full max-w-sm animate-slide-in-right overflow-hidden rounded-xl border bg-card py-3 pl-4 pr-3 shadow-dropdown before:absolute before:inset-y-0 before:left-0 before:w-1",
              VARIANT_STYLES[toast.variant]
            )}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-xs text-text-secondary">{toast.description}</p>}
              </div>
              <button
                type="button"
                aria-label="ปิดการแจ้งเตือน"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
