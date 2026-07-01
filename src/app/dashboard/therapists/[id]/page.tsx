import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { EditTherapistForm } from "./edit-therapist-form";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href="/dashboard/therapists" className="text-sm text-neutral-400">
        ← กลับ
      </Link>
      <h1 className="text-xl font-semibold">แก้ไขข้อมูลหมอนวด</h1>

      <Link
        href={`/dashboard/therapists/${therapist.id}/schedule`}
        className="rounded-lg border border-neutral-300 px-4 py-2 text-center text-sm"
      >
        จัดการตารางเวร / วันหยุด
      </Link>

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
    </main>
  );
}
