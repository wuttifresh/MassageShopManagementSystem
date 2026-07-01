import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">แดชบอร์ดหลังบ้าน</h1>
          <p className="text-sm text-neutral-500">
            สวัสดี {session.user.name} ({session.user.role})
          </p>
        </div>
        <SignOutButton />
      </header>
      <p className="text-neutral-500">
        หน้านี้เข้าได้เฉพาะ OWNER และ STAFF เท่านั้น (ป้องกันด้วย middleware) —
        ระบบคิว/POS/รายงานจะมาใน Phase ถัดไป
      </p>
    </main>
  );
}
