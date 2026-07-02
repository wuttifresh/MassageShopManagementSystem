import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { LoginForm } from "./login-form";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/dashboard",
  STAFF: "/dashboard",
  THERAPIST: "/therapist",
  CUSTOMER: "/account",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await getCurrentSession();
  if (session?.user) {
    // Never honor `callbackUrl` for an already-authenticated session: the only way to land here
    // while logged in is a wrong-role bounce (middleware/page guards send mismatched roles to
    // /login with the blocked path as callbackUrl) — redirecting back to that same path would
    // just bounce right back here again, looping forever. Always land on the role's own home.
    redirect(ROLE_HOME[session.user.role] ?? "/");
  }

  const callbackUrl = searchParams.callbackUrl ?? "/dashboard";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-soft">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">เข้าสู่ระบบ</h1>
        <p className="text-sm text-text-secondary">ระบบบริหารร้านนวด</p>
      </div>
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
