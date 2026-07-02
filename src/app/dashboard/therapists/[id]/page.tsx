import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { EditTherapistForm } from "./edit-therapist-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

export default async function EditTherapistPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect(`/login?callbackUrl=/dashboard/therapists/${params.id}`);
  }

  const therapist = await prisma.therapist.findUnique({
    where: { id: params.id },
    include: { specialties: true },
  });
  if (!therapist || therapist.deletedAt) notFound();
  if (session.user.role === "STAFF" && session.user.branchId !== therapist.branchId) notFound();

  const services = await prisma.service.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/therapists" title="แก้ไขข้อมูลหมอนวด" />

      <LinkButton variant="outline" href={`/dashboard/therapists/${therapist.id}/schedule`} fullWidth>
        จัดการตารางเวร / วันหยุด
      </LinkButton>

      <Card>
        <EditTherapistForm
          therapistId={therapist.id}
          services={services}
          initial={{
            nickname: therapist.nickname,
            bio: therapist.bio ?? "",
            status: therapist.status,
            commissionType: therapist.commissionType,
            commissionRate: therapist.commissionRate.toString(),
            specialtyServiceIds: therapist.specialties.map((s) => s.serviceId),
          }}
        />
      </Card>
    </div>
  );
}
