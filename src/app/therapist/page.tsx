import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import { EmptyState } from "@/components/ui/empty-state";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";

export default async function TherapistPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{dict.therapistPortal.title}</h1>
          <p className="truncate text-sm text-text-secondary">
            {dict.therapistPortal.greeting} {session.user.name}
          </p>
        </div>
        <SignOutButton className="shrink-0" />
      </header>
      <EmptyState
        icon="🚧"
        title={dict.therapistPortal.comingSoonTitle}
        description={dict.therapistPortal.comingSoonDescription}
      />
    </main>
  );
}
