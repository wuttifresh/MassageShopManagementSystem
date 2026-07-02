import type { Locale } from "./locales";
import type { Dictionary } from "./dictionaries/th";
import th from "./dictionaries/th";
import en from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { th, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
