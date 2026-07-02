"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./locales";
import type { Dictionary } from "./get-dictionary";

type LocaleContextValue = { locale: Locale; dict: Dictionary };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/// For Client Components anywhere in the tree — no prop drilling needed. Server Components
/// should call `getDictionary(getLocale())` directly instead (see src/i18n/get-dictionary.ts).
export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTranslation must be used within a LocaleProvider");
  return ctx;
}
