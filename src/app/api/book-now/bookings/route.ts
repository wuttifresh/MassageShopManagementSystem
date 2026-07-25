import { NextResponse } from "next/server";
import { BookingSource } from "@/generated/prisma/client";
import { normalizeThaiMobile } from "@/lib/phone";
import { verifyGuestPhoneToken } from "@/lib/guest-phone-token";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  BookingValidationError,
  Channel,
  SlotTakenError,
  createBooking,
} from "@/lib/booking-service";

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
  phoneToken?: unknown;
};

/// Creates a booking for a guest with no account (public /book-now, no login) — the "identity" is
/// a phone number OTP-verified moments earlier via /api/book-now/otp/*, proven here by
/// `phoneToken` rather than trusting the client-supplied `phone` outright (coding rule #5,
/// extended to this channel). Delegates all overlap protection, customer upsert, and audit
/// logging to the same channel-agnostic createBooking used by every other entry point.
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
  if (!isNonEmptyString(body.phoneToken)) missing.push("phoneToken");
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

  const secret = process.env.GUEST_PHONE_TOKEN_SECRET;
  if (!secret) throw new Error("GUEST_PHONE_TOKEN_SECRET is not configured");
  if (!verifyGuestPhoneToken(body.phoneToken as string, phone, secret)) {
    return NextResponse.json(
      { error: "ยืนยันเบอร์โทรศัพท์หมดอายุหรือไม่ถูกต้อง กรุณาขอรหัส OTP ใหม่" },
      { status: 401 }
    );
  }

  const rateLimit = checkRateLimit(`book-now-create-booking:${phone}`, CREATE_BOOKING_LIMIT, CREATE_BOOKING_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "คุณทำรายการจองบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }

  try {
    const booking = await createBooking({
      branchId: body.branchId as string,
      serviceOptionId: body.serviceOptionId as string,
      therapistId: isNonEmptyString(body.therapistId) ? body.therapistId : null,
      date: body.date as string,
      time: body.time as string,
      source: BookingSource.ONLINE,
      customer: {
        type: "channel",
        channel: Channel.WEB,
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
