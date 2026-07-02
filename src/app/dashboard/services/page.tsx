import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ListRow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ServicesPage() {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/services");
  }

  const services = await prisma.service.findMany({
    where: { deletedAt: null },
    include: { options: { orderBy: { durationMinutes: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="จัดการบริการ"
        description="รายการบริการและระยะเวลา/ราคาทั้งหมด"
        actions={<LinkButton href="/dashboard/services/new">+ เพิ่มบริการ</LinkButton>}
      />

      <div className="flex flex-col gap-2.5">
        {services.length === 0 && <EmptyState icon="🧴" title="ยังไม่มีบริการ" />}
        {services.map((s) => (
          <Link key={s.id} href={`/dashboard/services/${s.id}`}>
            <ListRow>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{s.name}</p>
                <p className="truncate text-text-secondary">
                  {s.options
                    .map((o) =>
                      o.promoPrice
                        ? `${o.durationMinutes}น. ฿${o.promoPrice} (ปกติ ฿${o.price})`
                        : `${o.durationMinutes}น. ฿${o.price}`
                    )
                    .join(" · ") || "ยังไม่มีตัวเลือกระยะเวลา"}
                </p>
              </div>
              <Badge variant={s.isActive ? "success" : "neutral"}>{s.isActive ? "เปิดขาย" : "ปิดขาย"}</Badge>
            </ListRow>
          </Link>
        ))}
      </div>
    </div>
  );
}
