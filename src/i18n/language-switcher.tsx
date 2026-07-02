import { cn } from "@/lib/cn";
import { setLocale } from "./actions";
import { getLocale } from "./get-locale";
import { getDictionary } from "./get-dictionary";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = getLocale();
  const dict = getDictionary(locale);

  return (
    <div
      className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-xs font-medium", className)}
      role="group"
      aria-label={dict.language.label}
    >
      {(["th", "en"] as const).map((code) => (
        <form key={code} action={setLocale.bind(null, code)}>
          <button
            type="submit"
            aria-current={locale === code || undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 uppercase tracking-wide transition-colors",
              locale === code ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            {code}
          </button>
        </form>
      ))}
    </div>
  );
}
