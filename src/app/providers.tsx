"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/get-dictionary";

export function Providers({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <LocaleProvider locale={locale} dict={dict}>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    </SessionProvider>
  );
}
