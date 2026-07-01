import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import LineProvider from "next-auth/providers/line";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/// Staff-side roles that are allowed to log in with email + password.
/// CUSTOMER is intentionally excluded — customers only authenticate via LINE Login.
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
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID ?? "",
      clientSecret: process.env.LINE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // LINE Login has no concept of our internal Role/User id, so resolve (or create) the
      // matching CUSTOMER row here and overwrite `user` with our own identity before the jwt
      // callback runs.
      if (account?.provider === "line") {
        const lineUserId = account.providerAccountId;

        let customer = await prisma.user.findUnique({ where: { lineUserId } });

        if (!customer) {
          customer = await prisma.user.create({
            data: {
              role: Role.CUSTOMER,
              name: user.name ?? "ลูกค้า LINE",
              image: user.image,
              lineUserId,
              lineDisplayName: user.name,
              membership: { create: {} },
            },
          });
        }

        if (!customer.isActive || customer.deletedAt) return false;

        user.id = customer.id;
        user.role = customer.role;
        user.branchId = null;
      }

      return true;
    },
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
