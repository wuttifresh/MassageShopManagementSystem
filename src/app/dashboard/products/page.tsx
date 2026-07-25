import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { PageHeader } from "@/components/ui/page-header";
import { ListRow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ProductsPage({ searchParams }: { searchParams: { branchId?: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/products");
  }

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  if (!activeBranchId) {
    return <EmptyState icon="🏢" title="ยังไม่มีสาขาที่ใช้งานอยู่" className="mt-10" />;
  }

  const products = await prisma.product.findMany({
    where: { branchId: activeBranchId, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="สินค้า Add-on"
        description="น้ำมัน/ชา/ของใช้ที่ขายเพิ่มที่ POS — สต๊อกแยกตามสาขา"
        actions={<LinkButton href="/dashboard/products/new">+ เพิ่มสินค้า</LinkButton>}
      />

      <div className="flex flex-col gap-2.5">
        {products.length === 0 && <EmptyState icon="🧴" title="ยังไม่มีสินค้าในสาขานี้" />}
        {products.map((p) => (
          <Link key={p.id} href={`/dashboard/products/${p.id}`}>
            <ListRow>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{p.name}</p>
                <p className="truncate text-text-secondary">
                  ฿{p.price.toString()} · เหลือ {p.stockQuantity} ชิ้น
                </p>
              </div>
              <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "เปิดขาย" : "ปิดขาย"}</Badge>
            </ListRow>
          </Link>
        ))}
      </div>
    </div>
  );
}
