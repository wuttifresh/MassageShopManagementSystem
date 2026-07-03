import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { LiffBookingWizard } from "./liff-booking-wizard";

// Public entry point for the LINE LIFF booking mini-app (multi-channel-booking-prompt.md, Phase
// 3) — identity comes from liff.getIDToken() inside the wizard, not a NextAuth session, so this
// page intentionally has no session check/redirect (unlike src/app/book/page.tsx).
export default function LiffBookingPage() {
  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{dict.liffBooking.pageTitle}</h1>
        <LanguageSwitcher />
      </div>
      <LiffBookingWizard />
    </main>
  );
}
