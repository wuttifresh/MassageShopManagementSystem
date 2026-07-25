import { NextResponse } from "next/server";
import { normalizeThaiMobile } from "@/lib/phone";
import { findGuestBooking } from "@/lib/booking-service";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const LOOKUP_LIMIT = 10;
const LOOKUP_WINDOW_MS = 10 * 60_000;
const NOT_FOUND_MESSAGE = "ไม่พบการจองนี้ กรุณาตรวจสอบรหัสจองและเบอร์โทรศัพท์อีกครั้ง";

/// Looks up a /book-now (guest, no-login) booking by code + phone — the only "login" a guest has.
/// Always returns the same not-found message whether the code doesn't exist or the phone doesn't
/// match, so this can't be used to enumerate valid booking codes or phone numbers.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const phoneRaw = searchParams.get("phone");

  if (!code || !phoneRaw) {
    return NextResponse.json({ error: "กรุณาระบุรหัสจองและเบอร์โทรศัพท์" }, { status: 400 });
  }

  const phone = normalizeThaiMobile(phoneRaw);
  if (!phone) {
    return NextResponse.json({ error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`book-now-lookup:${phone}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "ค้นหาบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }

  const booking = await findGuestBooking(code.trim().toUpperCase(), phone);
  if (!booking) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      code: booking.code,
      status: booking.status,
      startTime: booking.startTime,
      endTime: booking.endTime,
      branchId: booking.branchId,
      branchName: booking.branch.name,
      serviceId: booking.serviceOption.serviceId,
      serviceName: booking.serviceOption.service.name,
      durationMinutes: booking.serviceOption.durationMinutes,
      // Null means the original booking was "any therapist" — reschedule should keep offering
      // every eligible therapist's slots, not just one, so the manage page needs to know which.
      therapistId: booking.therapistId,
      therapistNickname: booking.therapist?.nickname ?? null,
    },
  });
}
