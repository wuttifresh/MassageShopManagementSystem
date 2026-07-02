import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { SearchForm } from "./search-form";
import { PageHeader } from "@/components/ui/page-header";
import { ListRow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/customers");
  }

  const query = searchParams.q?.trim();

  const customers = query
    ? await prisma.user.findMany({
        where: {
          role: "CUSTOMER",
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { lineDisplayName: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { membership: true },
        take: 20,
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="ลูกค้า" description="ค้นหาและจัดการข้อมูลลูกค้า" />

      <SearchForm initialQuery={query ?? ""} />

      <div className="flex flex-col gap-2.5">
        {query && customers.length === 0 && (
          <EmptyState icon="🔍" title={`ไม่พบลูกค้าที่ตรงกับ "${query}"`} />
        )}
        {!query && (
          <EmptyState icon="👤" title="ค้นหาลูกค้าเพื่อดูรายละเอียด" description="พิมพ์ชื่อหรือเบอร์โทรด้านบน" />
        )}
        {customers.map((c) => (
          <Link key={c.id} href={`/dashboard/customers/${c.id}`}>
            <ListRow>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{c.name}</p>
                <p className="text-text-secondary">{c.phone ?? "ไม่มีเบอร์โทร"}</p>
              </div>
              {c.membership && (
                <Badge variant="primary">
                  {c.membership.tier} · {c.membership.points} แต้ม
                </Badge>
              )}
            </ListRow>
          </Link>
        ))}
      </div>
    </div>
  );
}
