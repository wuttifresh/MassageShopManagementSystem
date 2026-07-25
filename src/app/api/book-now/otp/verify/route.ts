import { NextResponse } from "next/server";
import { normalizeThaiMobile } from "@/lib/phone";
import { verifyPhoneOtp } from "@/lib/phone-otp";
import { issueGuestPhoneToken } from "@/lib/guest-phone-token";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_LIMIT = 8;
const VERIFY_WINDOW_MS = 10 * 60_000;
const CODE_PATTERN = /^\d{6}$/;

export async function POST(request: Request) {
  let body: { phone?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, { status: 400 });
  }

  if (typeof body.phone !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ error: "กรุณาระบุเบอร์โทรศัพท์และรหัสยืนยัน" }, { status: 400 });
  }

  const phone = normalizeThaiMobile(body.phone);
  if (!phone) {
    return NextResponse.json({ error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!CODE_PATTERN.test(body.code)) {
    return NextResponse.json({ error: "รหัสยืนยันไม่ถูกต้อง" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`book-now-otp-verify:${phone}`, VERIFY_LIMIT, VERIFY_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "ลองยืนยันบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }

  const result = await verifyPhoneOtp(phone, body.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const secret = process.env.GUEST_PHONE_TOKEN_SECRET;
  if (!secret) throw new Error("GUEST_PHONE_TOKEN_SECRET is not configured");

  return NextResponse.json({ phoneToken: issueGuestPhoneToken(phone, secret) });
}
