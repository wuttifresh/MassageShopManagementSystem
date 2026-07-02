import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function TherapistPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">หน้าหมอนวด</h1>
          <p className="truncate text-sm text-text-secondary">สวัสดี {session.user.name}</p>
        </div>
        <SignOutButton className="shrink-0" />
      </header>
      <EmptyState
        icon="🚧"
        title="กำลังพัฒนา"
        description="ตารางเวร/คิวของฉัน/ค่ามือ จะมาใน Phase ถัดไป"
      />
    </main>
  );
}
