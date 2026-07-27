import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { Alert } from "@/components/ui/alert";

// LINE LIFF booking is temporarily disabled — new bookings go through /book-now instead.
// LiffBookingWizard (./liff-booking-wizard.tsx) is left in place unused so this entry point can
// be flipped back on later.
export default function LiffBookingPage() {
  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{dict.liffBooking.pageTitle}</h1>
        <LanguageSwitcher />
      </div>
      <Alert variant="warning" title={dict.channelDisabled.title}>
        {dict.channelDisabled.description}
      </Alert>
    </main>
  );
}
