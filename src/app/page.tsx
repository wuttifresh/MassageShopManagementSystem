import { getCurrentSession } from "@/lib/session";
import { LinkButton } from "@/components/ui/link-button";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/dashboard",
  STAFF: "/dashboard",
  THERAPIST: "/therapist",
  CUSTOMER: "/account",
};

export default async function Home() {
  const session = await getCurrentSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-soft">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">ระบบบริหารร้านนวด</h1>
      <p className="max-w-sm text-text-secondary">
        Phase 2 — ระบบยืนยันตัวตนและสิทธิ์การใช้งานเสร็จแล้ว หน้าจองคิวจะเริ่มใน Phase 3
      </p>
      {session?.user ? (
        <LinkButton href={ROLE_HOME[session.user.role] ?? "/"}>ไปหน้าของฉัน ({session.user.role})</LinkButton>
      ) : (
        <LinkButton href="/login">เข้าสู่ระบบ</LinkButton>
      )}
    </main>
  );
}
