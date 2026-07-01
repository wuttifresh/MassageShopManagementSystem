import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

/// For OWNER-only pages under /dashboard, where middleware itself only enforces the broader
/// OWNER-or-STAFF set (so a logged-in STAFF user reaches this page component). Redirecting an
/// already-authenticated wrong-role user to /login would just bounce them right back here via
/// callbackUrl (infinite loop) — so only /login gets used when there's no session at all.
export async function requireOwnerPage(callbackUrl: string) {
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/login?callbackUrl=${callbackUrl}`);
  if (session.user.role !== "OWNER") redirect("/dashboard");
  return session;
}
