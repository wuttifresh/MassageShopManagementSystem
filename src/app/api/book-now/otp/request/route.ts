import { NextResponse } from "next/server";
import { normalizeThaiMobile } from "@/lib/phone";
import { requestPhoneOtp } from "@/lib/phone-otp";
import { checkRateLimit } from "@/lib/rate-limit";

// requestPhoneOtp uses node:crypto (via phone-otp.ts) and must never be prerendered as static.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_LIMIT = 3;
const REQUEST_WINDOW_MS = 10 * 60_000;

export async function POST(request: Request) {
  let body: { phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, { status: 400 });
  }

  if (typeof body.phone !== "string" || body.phone.trim().length === 0) {
    return NextResponse.json({ error: "กรุณาระบุเบอร์โทรศัพท์" }, { status: 400 });
  }

  const phone = normalizeThaiMobile(body.phone);
  if (!phone) {
    return NextResponse.json({ error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`book-now-otp-request:${phone}`, REQUEST_LIMIT, REQUEST_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "ขอรหัสยืนยันบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }

  const result = await requestPhoneOtp(phone);
  if (!result.ok) {
    return NextResponse.json({ error: "ไม่สามารถส่งรหัสยืนยันผ่าน WhatsApp ได้ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
