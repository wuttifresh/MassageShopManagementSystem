import { getCurrentSession } from "@/lib/session";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    // Not authorized for this area — render children as-is so each page's own
    // `redirect()` guard (already in place) can run and take over.
    return <>{children}</>;
  }

  return (
    <DashboardShell user={{ name: session.user.name ?? "", role: session.user.role }}>
      {children}
    </DashboardShell>
  );
}
