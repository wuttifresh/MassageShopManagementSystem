import { signPayload, verifyPayload } from "@/lib/whatsapp-flow-token";

/// Short-lived proof that a guest's phone number passed the WhatsApp OTP challenge
/// (src/lib/phone-otp.ts) — issued by POST /api/book-now/otp/verify, checked by every
/// /api/book-now/bookings write so a client can never just claim a phone number without having
/// verified it (coding rule #5, extended to the new no-login web channel). Reuses
/// whatsapp-flow-token.ts's generic HMAC signer rather than duplicating it; `secret` here is
/// GUEST_PHONE_TOKEN_SECRET, deliberately separate from WA_FLOW_TOKEN_SECRET.
const PHONE_TOKEN_TTL_MS = 15 * 60_000;

type GuestPhonePayload = { phone: string };

export function issueGuestPhoneToken(phone: string, secret: string): string {
  return signPayload<GuestPhonePayload>({ phone }, secret, PHONE_TOKEN_TTL_MS);
}

export function verifyGuestPhoneToken(token: string, phone: string, secret: string): boolean {
  const decoded = verifyPayload<GuestPhonePayload>(token, secret);
  return decoded !== null && decoded.phone === phone;
}
