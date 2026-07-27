import { NextResponse } from "next/server";
import { normalizeThaiMobile } from "@/lib/phone";
import { checkRateLimit } from "@/lib/rate-limit";
import { BookingValidationError, SlotTakenError } from "@/lib/booking-service";
import { createBookingViaCore } from "@/lib/booking-core-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CREATE_BOOKING_LIMIT = 5;
const CREATE_BOOKING_WINDOW_MS = 5 * 60_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type CreateGuestBookingBody = {
  branchId?: unknown;
  serviceOptionId?: unknown;
  therapistId?: unknown;
  date?: unknown;
  time?: unknown;
  guestName?: unknown;
  phone?: unknown;
};

/// Creates a booking for a guest with no account (public /book-now, no login) — identity is just
/// the client-supplied guestName/phone, same trust level as booking-service.ts's other guest
/// lookup paths (no OTP/verification step). Delegates overlap protection, customer upsert, and
/// audit logging to services/booking-core (the Go/Fiber Phase 1 service) via createBookingViaCore
/// — see the Phase 2 plan for why this moved off the TypeScript createBooking in
/// booking-service.ts.
export async function POST(request: Request) {
  let body: CreateGuestBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, { status: 400 });
  }

  const missing: string[] = [];
  if (!isNonEmptyString(body.branchId)) missing.push("branchId");
  if (!isNonEmptyString(body.serviceOptionId)) missing.push("serviceOptionId");
  if (!isNonEmptyString(body.date)) missing.push("date");
  if (!isNonEmptyString(body.time)) missing.push("time");
  if (!isNonEmptyString(body.guestName)) missing.push("guestName");
  if (!isNonEmptyString(body.phone)) missing.push("phone");
  if (missing.length > 0) {
    return NextResponse.json({ error: `กรุณาระบุข้อมูลให้ครบ: ${missing.join(", ")}` }, { status: 400 });
  }
  if (!DATE_PATTERN.test(body.date as string)) {
    return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" }, { status: 400 });
  }
  if (!TIME_PATTERN.test(body.time as string)) {
    return NextResponse.json({ error: "รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:mm)" }, { status: 400 });
  }
  if (body.therapistId !== undefined && body.therapistId !== null && !isNonEmptyString(body.therapistId)) {
    return NextResponse.json({ error: "therapistId ไม่ถูกต้อง" }, { status: 400 });
  }

  const phone = normalizeThaiMobile(body.phone as string);
  if (!phone) {
    return NextResponse.json({ error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`book-now-create-booking:${phone}`, CREATE_BOOKING_LIMIT, CREATE_BOOKING_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "คุณทำรายการจองบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }

  try {
    const booking = await createBookingViaCore({
      branchId: body.branchId as string,
      serviceOptionId: body.serviceOptionId as string,
      therapistId: isNonEmptyString(body.therapistId) ? body.therapistId : null,
      date: body.date as string,
      time: body.time as string,
      source: "ONLINE",
      customer: {
        channel: "WEB",
        channelUserId: phone,
        name: (body.guestName as string).trim(),
        phone,
      },
    });

    return NextResponse.json(
      { bookingId: booking.id, code: booking.code, startTime: booking.startTime, endTime: booking.endTime },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof BookingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
