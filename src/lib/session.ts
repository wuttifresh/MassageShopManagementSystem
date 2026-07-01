import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export function getCurrentSession() {
  return getServerSession(authOptions);
}
