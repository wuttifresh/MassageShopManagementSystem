import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { BookNowWizard } from "./booking-wizard";
import { getActiveBranches, getActiveServices } from "@/lib/catalog";

// Public web booking, no account/login required — a client-supplied phone number stands in for
// identity, with no verification step. See /book (temporarily disabled) and /liff/booking (LINE)
// for the other, session-based booking entry points.
//
// `?branch=<slug>` and `?option=<serviceOptionId>` preselect the branch/service+duration steps —
// see /dashboard/booking-links (Phase 2) for where staff generate these share links + QR codes.
//
// Branches/services are fetched here, server-side, instead of by BookNowWizard on mount: that used
// to mean the client shipped an empty shell, hydrated, then fired two more requests (each a
// separate serverless invocation + DB round trip) before showing anything. Fetching them as part
// of this page's own render collapses that into a single request.
export default async function BookNowPage({
  searchParams,
}: {
  searchParams: { branch?: string; option?: string };
}) {
  const dict = getDictionary(getLocale());
  const [branches, services] = await Promise.all([getActiveBranches(), getActiveServices()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{dict.bookNow.pageTitle}</h1>
        <LanguageSwitcher />
      </div>
      <BookNowWizard
        initialBranches={branches.map((b) => ({ id: b.id, name: b.name, slug: b.slug, address: b.address }))}
        initialServices={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          options: s.options.map((o) => ({
            id: o.id,
            durationMinutes: o.durationMinutes,
            price: o.price.toString(),
            promoPrice: o.promoPrice?.toString() ?? null,
          })),
        }))}
        initialBranchSlug={searchParams.branch}
        initialServiceOptionId={searchParams.option}
      />
    </main>
  );
}
