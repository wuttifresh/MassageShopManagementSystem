import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/// Staff-side roles that are allowed to log in with email + password.
/// CUSTOMER is intentionally excluded — customer-facing login (LINE) has been retired; customers
/// book through /book-now now (see src/app/api/bookings/route.ts).
const CREDENTIALS_LOGIN_ROLES: Role[] = [Role.OWNER, Role.STAFF, Role.THERAPIST];

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "อีเมล/รหัสผ่าน",
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) return null;
        if (!user.isActive || user.deletedAt) return null;
        if (!CREDENTIALS_LOGIN_ROLES.includes(user.role)) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          branchId: user.branchId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.branchId = user.branchId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.branchId = token.branchId;
      return session;
    },
  },
};
