import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";

/// Route prefixes gated by role. Checked in order; the first matching prefix wins.
const PROTECTED_ROUTES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/dashboard", roles: [Role.OWNER, Role.STAFF] },
  { prefix: "/therapist", roles: [Role.THERAPIST] },
  { prefix: "/account", roles: [Role.CUSTOMER] },
  { prefix: "/book", roles: [Role.CUSTOMER] },
];

const ROLE_HOME: Record<Role, string> = {
  [Role.OWNER]: "/dashboard",
  [Role.STAFF]: "/dashboard",
  [Role.THERAPIST]: "/therapist",
  [Role.CUSTOMER]: "/account",
};

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    const rule = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));
    if (rule) {
      if (!role) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
      if (!rule.roles.includes(role)) {
        // Logged in, just the wrong role for this area. Sending them to /login would only
        // bounce them right back here via callbackUrl (loops) — send them to their own home
        // area instead.
        return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
      }
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      // Always run the middleware above; it decides per-route whether a token is required.
      // (Returning true here just means "don't let next-auth's default check short-circuit us".)
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/therapist/:path*", "/account/:path*", "/book/:path*"],
};
