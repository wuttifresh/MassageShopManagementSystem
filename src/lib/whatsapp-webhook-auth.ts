import { createHmac, timingSafeEqual } from "node:crypto";

/// Verifies the `X-Hub-Signature-256` header Meta attaches to every webhook delivery: HMAC-SHA256
/// of the raw request body, hex-encoded and prefixed with "sha256=", keyed with the WhatsApp app's
/// App Secret (WA_APP_SECRET — from the app's Basic Settings in Meta's developer console, not the
/// Flow encryption key). This is the entire trust boundary for inbound WhatsApp webhook events
/// (coding rule #5) — `rawBody` must be the untouched request body (before any JSON.parse).
export function verifyWhatsAppWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WA_APP_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}
