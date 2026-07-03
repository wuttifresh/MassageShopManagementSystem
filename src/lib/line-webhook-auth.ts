import { createHmac, timingSafeEqual } from "node:crypto";

/// Verifies the `X-Line-Signature` header LINE attaches to every webhook delivery: HMAC-SHA256 of
/// the raw request body, base64-encoded, keyed with the Messaging API channel's channel secret
/// (LINE_MESSAGING_CHANNEL_SECRET — distinct from LINE_CLIENT_SECRET, which belongs to the
/// separate LINE Login channel used for customer auth). This is the entire trust boundary for
/// inbound LINE webhook events (coding rule #5) — `rawBody` must be the untouched request body
/// (before any JSON.parse), since HMAC is sensitive to exact byte content.
export function verifyLineWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}
