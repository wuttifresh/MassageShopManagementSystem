import { NextResponse } from "next/server";
import { getActiveBranches } from "@/lib/catalog";

// No request-time API (cookies/headers/searchParams) is used here, so Next.js would otherwise
// treat this as a static route and bake the branch list in at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const branches = await getActiveBranches();

  return NextResponse.json({ branches });
}
