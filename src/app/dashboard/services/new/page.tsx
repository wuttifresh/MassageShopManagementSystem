import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { NewServiceForm } from "./new-service-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function NewServicePage() {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/services/new");
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <PageHeader backHref="/dashboard/services" title="เพิ่มบริการ" />
      <Card>
        <NewServiceForm />
      </Card>
    </div>
  );
}
