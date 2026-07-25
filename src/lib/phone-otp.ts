import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp-messaging";
import type { SendResult } from "@/lib/send-result";

/// OTP-gated phone verification for /book-now (public web booking, no account) — see
/// prisma/schema.prisma's PhoneOtpChallenge doc comment. Delivery must go through a pre-approved
/// WhatsApp "Authentication" template, not free-form text: a guest coming from the public web has
/// never messaged the business number, so they're outside Meta's 24-hour session window where
/// free-form messages are deliverable (same constraint as the booking reminder in
/// /api/cron/channel-reminders).
const OTP_TTL_MS = 5 * 60_000;
const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function generateCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/// Creates a new OTP challenge for `phone` (already normalized — see src/lib/phone.ts) and sends
/// it via WhatsApp. Never throws — matches sendWhatsAppTemplateMessage's own never-throw contract;
/// the caller is responsible for rate-limiting how often this can be called per phone/IP.
export async function requestPhoneOtp(phone: string): Promise<SendResult> {
  const code = generateCode();
  await prisma.phoneOtpChallenge.create({
    data: { phone, codeHash: hashCode(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const templateName = process.env.WA_OTP_TEMPLATE_NAME;
  if (!templateName) {
    console.log(`[phone-otp] WA_OTP_TEMPLATE_NAME not configured, would have sent ${code} to ${phone}`);
    return { ok: false, error: "WA_OTP_TEMPLATE_NAME is not configured" };
  }

  const languageCode = process.env.WA_OTP_TEMPLATE_LANG || "th";
  // Meta's Cloud API expects the recipient in international format without a leading "+".
  return sendWhatsAppTemplateMessage(phone.replace(/^\+/, ""), templateName, languageCode, [code]);
}

export type VerifyPhoneOtpResult = { ok: true } | { ok: false; error: string };

/// Checks `code` against the most recent, unexpired, unconsumed challenge for `phone`. Marks it
/// consumed on success so the same code can't be reused to mint a second phoneToken later.
export async function verifyPhoneOtp(phone: string, code: string): Promise<VerifyPhoneOtpResult> {
  const challenge = await prisma.phoneOtpChallenge.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) {
    return { ok: false, error: "รหัสยืนยันหมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่" };
  }
  if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "กรอกรหัสผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่" };
  }

  if (!hashesEqual(hashCode(code), challenge.codeHash)) {
    await prisma.phoneOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "รหัสยืนยันไม่ถูกต้อง" };
  }

  await prisma.phoneOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
