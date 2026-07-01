import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { EditServiceForm } from "./edit-service-form";
import { ServiceOptionRow } from "./service-option-row";
import { AddOptionForm } from "./add-option-form";

export default async function EditServicePage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect(`/login?callbackUrl=/dashboard/services/${params.id}`);
  }

  const service = await prisma.service.findUnique({
    where: { id: params.id },
    include: { options: { orderBy: { durationMinutes: "asc" } } },
  });
  if (!service || service.deletedAt) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href="/dashboard/services" className="text-sm text-neutral-400">
        ← กลับ
      </Link>
      <h1 className="text-xl font-semibold">แก้ไขบริการ</h1>

      <EditServiceForm
        serviceId={service.id}
        initial={{
          name: service.name,
          category: service.category ?? "",
          description: service.description ?? "",
          isActive: service.isActive,
        }}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">ระยะเวลาและราคา</h2>
        {service.options.map((option) => (
          <ServiceOptionRow
            key={option.id}
            optionId={option.id}
            durationMinutes={option.durationMinutes}
            initial={{
              price: option.price.toString(),
              promoPrice: option.promoPrice?.toString() ?? "",
              isActive: option.isActive,
            }}
          />
        ))}
        <AddOptionForm serviceId={service.id} />
      </section>
    </main>
  );
}
