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
    redirect(searchParams.callbackUrl ?? ROLE_HOME[session.user.role] ?? "/");
  }

  const callbackUrl = searchParams.callbackUrl ?? "/dashboard";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
