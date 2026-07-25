import { NextResponse } from "next/server";
import { normalizeThaiMobile } from "@/lib/phone";
import { rescheduleGuestBooking } from "@/lib/booking-service";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const LIMIT = 10;
const WINDOW_MS = 10 * 60_000;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let body: { phone?: unknown; date?: unknown; time?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, { status: 400 });
  }

  if (typeof body.phone !== "string" || typeof body.date !== "string" || typeof body.time !== "string") {
    return NextResponse.json({ error: "กรุณาระบุเบอร์โทรศัพท์ วันที่ และเวลา" }, { status: 400 });
  }
  if (!DATE_PATTERN.test(body.date)) {
    return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" }, { status: 400 });
  }
  if (!TIME_PATTERN.test(body.time)) {
    return NextResponse.json({ error: "รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:mm)" }, { status: 400 });
  }

  const phone = normalizeThaiMobile(body.phone);
  if (!phone) {
    return NextResponse.json({ error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`book-now-reschedule:${phone}`, LIMIT, WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "ทำรายการบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }

  const result = await rescheduleGuestBooking(params.id, phone, body.date, body.time);
  if (!result.success) {
    // "wrong phone"/"no such booking" (404) vs. a real business-rule failure — wrong status,
    // slot taken, or below the 1-hour lead time (409/400, folded into 409 here since the guest's
    // only actionable response either way is "pick a different time").
    return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 409 });
  }

  return NextResponse.json({
    bookingId: result.data.id,
    code: result.data.code,
    startTime: result.data.startTime,
    endTime: result.data.endTime,
  });
}
