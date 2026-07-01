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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
