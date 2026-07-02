import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { EditServiceForm } from "./edit-service-form";
import { ServiceOptionRow } from "./service-option-row";
import { AddOptionForm } from "./add-option-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";

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
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/services" title="แก้ไขบริการ" />

      <Card>
        <EditServiceForm
          serviceId={service.id}
          initial={{
            name: service.name,
            category: service.category ?? "",
            description: service.description ?? "",
            isActive: service.isActive,
          }}
        />
      </Card>

      <Card>
        <CardHeader title="ระยะเวลาและราคา" />
        <div className="flex flex-col gap-2.5">
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
        </div>
      </Card>
    </div>
  );
}
