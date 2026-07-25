import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { BookNowWizard } from "./booking-wizard";

// Public web booking, no account/login required — a phone number OTP-verified via WhatsApp
// (src/lib/phone-otp.ts) stands in for identity. See /book (retired in favor of WhatsApp-only)
// and /liff/booking (LINE) for the other, session-based booking entry points.
//
// `?branch=<slug>` and `?option=<serviceOptionId>` preselect the branch/service+duration steps —
// see /dashboard/booking-links (Phase 2) for where staff generate these share links + QR codes.
export default function BookNowPage({
  searchParams,
}: {
  searchParams: { branch?: string; option?: string };
}) {
  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{dict.bookNow.pageTitle}</h1>
        <LanguageSwitcher />
      </div>
      <BookNowWizard initialBranchSlug={searchParams.branch} initialServiceOptionId={searchParams.option} />
    </main>
  );
}
