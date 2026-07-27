import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { Alert } from "@/components/ui/alert";

// Web booking is temporarily disabled — new bookings go through /book-now instead.
// BookingWizard (./booking-wizard.tsx) and its server action (./actions.ts) are left in place
// unused so this entry point can be flipped back on later.
export default async function BookPage() {
  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{dict.book.pageTitle}</h1>
        <LanguageSwitcher />
      </div>
      <Alert variant="warning" title={dict.channelDisabled.title}>
        {dict.channelDisabled.description}
      </Alert>
    </main>
  );
}
