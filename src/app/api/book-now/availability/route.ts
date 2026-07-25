import { NextResponse } from "next/server";
import { getAvailabilityFromCore } from "@/lib/booking-core-client";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/// Slot query for /book-now, proxied to services/booking-core (Go/Fiber) instead of
/// src/lib/availability.ts — see the Phase 2 plan. Takes serviceOptionId directly rather than
/// serviceId+durationMinutes (the shape /api/availability uses): booking-core derives duration
/// from the service option itself, so the caller doesn't need to look it up separately.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const serviceOptionId = searchParams.get("serviceOptionId");
  const therapistId = searchParams.get("therapistId"); // omitted/empty = "any therapist"
  const dateParam = searchParams.get("date"); // YYYY-MM-DD

  if (!branchId || !serviceOptionId || !dateParam) {
    return NextResponse.json({ error: "ต้องระบุ branchId, serviceOptionId และ date" }, { status: 400 });
  }
  if (!DATE_PATTERN.test(dateParam)) {
    return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" }, { status: 400 });
  }

  const slots = await getAvailabilityFromCore({
    branchId,
    serviceOptionId,
    therapistId: therapistId || undefined,
    date: dateParam,
  });

  return NextResponse.json({ slots });
}
