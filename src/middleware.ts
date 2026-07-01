import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";

/// Route prefixes gated by role. Checked in order; the first matching prefix wins.
const PROTECTED_ROUTES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/dashboard", roles: [Role.OWNER, Role.STAFF] },
  { prefix: "/therapist", roles: [Role.THERAPIST] },
  { prefix: "/account", roles: [Role.CUSTOMER] },
];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    const rule = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));
    if (rule && (!role || !rule.roles.includes(role))) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
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
  matcher: ["/dashboard/:path*", "/therapist/:path*", "/account/:path*"],
};
