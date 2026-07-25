import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { NewProductForm } from "./new-product-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function NewProductPage({ searchParams }: { searchParams: { branchId?: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/products/new");
  }

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  if (!activeBranchId) redirect("/dashboard/products");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/products" title="เพิ่มสินค้า" />
      <Card>
        <NewProductForm branchId={activeBranchId} />
      </Card>
    </div>
  );
}
