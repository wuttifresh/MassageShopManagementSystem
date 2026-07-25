import { NextResponse } from "next/server";
import { normalizeThaiMobile } from "@/lib/phone";
import { cancelGuestBooking } from "@/lib/booking-service";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const LIMIT = 10;
const WINDOW_MS = 10 * 60_000;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let body: { phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, { status: 400 });
  }

  if (typeof body.phone !== "string") {
    return NextResponse.json({ error: "กรุณาระบุเบอร์โทรศัพท์" }, { status: 400 });
  }
  const phone = normalizeThaiMobile(body.phone);
  if (!phone) {
    return NextResponse.json({ error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`book-now-cancel:${phone}`, LIMIT, WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "ทำรายการบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }

  const result = await cancelGuestBooking(params.id, phone);
  if (!result.success) {
    // "wrong phone" and "no such booking" are deliberately indistinguishable (404); a booking
    // that exists but is already cancelled/completed/etc. is a 409 instead.
    return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 409 });
  }

  return NextResponse.json({ ok: true });
}
