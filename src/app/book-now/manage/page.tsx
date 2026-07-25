import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { ManageBooking } from "./manage-booking";

export default function BookNowManagePage() {
  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{dict.bookNowManage.pageTitle}</h1>
        <LanguageSwitcher />
      </div>
      <ManageBooking />
    </main>
  );
}
