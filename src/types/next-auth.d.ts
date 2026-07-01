import type { Role } from "@/generated/prisma/enums";
import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    role: Role;
    branchId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      branchId?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: Role;
    branchId?: string | null;
  }
}
