import { NextResponse } from "next/server";
import { getActiveServices } from "@/lib/catalog";

// No request-time API (cookies/headers/searchParams) is used here, so Next.js would otherwise
// treat this as a static route and bake the service list in at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const services = await getActiveServices();

  return NextResponse.json({ services });
}
