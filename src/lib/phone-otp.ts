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
/// Fixed code accepted in place of the real one when OTP_DEBUG_MODE=true — lets a tester skip
/// checking server logs for the actual code entirely. See requestPhoneOtp's doc comment for why
/// this whole mode must never be enabled once real customers can reach /book-now.
const DEBUG_MODE_CODE = "000000";

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
///
/// OTP_DEBUG_MODE=true is an explicit, opt-in escape hatch for testing /book-now before the
/// WhatsApp Business Authentication template is approved: it reports success (so the booking
/// wizard proceeds to the code-entry step) even though no message was actually sent, with the
/// code visible only in server logs — never in the API response. verifyPhoneOtp also accepts the
/// fixed DEBUG_MODE_CODE ("000000") in this mode, so testing doesn't require reading logs at all.
/// This means phone verification is effectively disabled while the flag is set — it must never be
/// enabled once real customers can reach this endpoint: anyone could complete "verification" for
/// any phone number just by typing 000000, without ever possessing that phone. Remove the env var
/// (or leave it unset) as soon as WA_MESSAGING_ACCESS_TOKEN/WA_PHONE_NUMBER_ID/WA_OTP_TEMPLATE_NAME
/// are all configured and delivering real messages.
export async function requestPhoneOtp(phone: string): Promise<SendResult> {
  const code = generateCode();
  await prisma.phoneOtpChallenge.create({
    data: { phone, codeHash: hashCode(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const debugMode = process.env.OTP_DEBUG_MODE === "true";
  const templateName = process.env.WA_OTP_TEMPLATE_NAME;
  if (!templateName) {
    console.log(`[phone-otp] WA_OTP_TEMPLATE_NAME not configured, would have sent ${code} to ${phone}`);
    if (debugMode) {
      console.warn("[phone-otp] OTP_DEBUG_MODE=true — reporting success without sending a real message");
      return { ok: true };
    }
    return { ok: false, error: "WA_OTP_TEMPLATE_NAME is not configured" };
  }

  const languageCode = process.env.WA_OTP_TEMPLATE_LANG || "th";
  // Meta's Cloud API expects the recipient in international format without a leading "+".
  const result = await sendWhatsAppTemplateMessage(phone.replace(/^\+/, ""), templateName, languageCode, [code]);
  if (!result.ok && debugMode) {
    console.warn(`[phone-otp] send failed (${result.error}) but OTP_DEBUG_MODE=true — reporting success. Code was ${code}`);
    return { ok: true };
  }
  return result;
}

export type VerifyPhoneOtpResult = { ok: true } | { ok: false; error: string };

/// Checks `code` against the most recent, unexpired, unconsumed challenge for `phone`. Marks it
/// consumed on success so the same code can't be reused to mint a second phoneToken later.
export async function verifyPhoneOtp(phone: string, code: string): Promise<VerifyPhoneOtpResult> {
  if (process.env.OTP_DEBUG_MODE === "true" && code === DEBUG_MODE_CODE) {
    console.warn(`[phone-otp] OTP_DEBUG_MODE=true — accepted debug code ${DEBUG_MODE_CODE} for ${phone} without checking WhatsApp delivery`);
    return { ok: true };
  }

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
