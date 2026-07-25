import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";
import { BookingLinkGenerator } from "./booking-link-generator";

/// Phase 2 of the booking-core migration plan: staff-facing generator for /book-now share links
/// (a stable per-branch "shop link", or a service/promo link that preselects a service+duration)
/// plus a QR code for each, so a link can be printed/shared without retyping a URL.
export default async function BookingLinksPage() {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/booking-links");
  }

  const dict = getDictionary(getLocale());

  const [branches, services] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { isActive: true, deletedAt: null, options: { some: { isActive: true } } },
      select: {
        id: true,
        name: true,
        options: { where: { isActive: true }, select: { id: true, durationMinutes: true }, orderBy: { durationMinutes: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={dict.bookingLinks.title} description={dict.bookingLinks.description} />
      <BookingLinkGenerator branches={branches} services={services} />
    </div>
  );
}
