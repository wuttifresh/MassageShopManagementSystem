import Link from "next/link";
import { getCurrentSession } from "@/lib/session";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/dashboard",
  STAFF: "/dashboard",
  THERAPIST: "/therapist",
  CUSTOMER: "/account",
};

export default async function Home() {
  const session = await getCurrentSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">ระบบบริหารร้านนวด</h1>
      <p className="text-neutral-500">
        Phase 2 — ระบบยืนยันตัวตนและสิทธิ์การใช้งานเสร็จแล้ว หน้าจองคิวจะเริ่มใน Phase 3
      </p>
      {session?.user ? (
        <Link
          href={ROLE_HOME[session.user.role] ?? "/"}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          ไปหน้าของฉัน ({session.user.role})
        </Link>
      ) : (
        <Link
          href="/login"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          เข้าสู่ระบบ
        </Link>
      )}
    </main>
  );
}
