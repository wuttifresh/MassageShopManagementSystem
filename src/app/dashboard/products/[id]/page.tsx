import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { EditProductForm } from "./edit-product-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect(`/login?callbackUrl=/dashboard/products/${params.id}`);
  }

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product || product.deletedAt) notFound();
  if (session.user.role === "STAFF" && session.user.branchId !== product.branchId) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/products" title="แก้ไขสินค้า" />
      <Card>
        <EditProductForm
          productId={product.id}
          initial={{
            name: product.name,
            price: product.price.toString(),
            stockQuantity: String(product.stockQuantity),
            isActive: product.isActive,
          }}
        />
      </Card>
    </div>
  );
}
