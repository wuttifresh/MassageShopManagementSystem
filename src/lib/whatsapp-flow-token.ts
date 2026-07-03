import { createHmac, timingSafeEqual } from "node:crypto";

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

/// Generic HMAC-signed, expiring token — deliberately not JWT (no algorithm-confusion surface, no
/// extra dependency) since this module is the only issuer and the only verifier. Used for two
/// distinct purposes in the WhatsApp booking flow (see whatsapp-flow-screens.ts):
///  1. `state_token` — threads the customer's branch/service/date/time selections across screens,
///     so a forged data_exchange request can't jump straight to CONFIRM with fabricated
///     selections (coding rule #5 extended to intra-flow state, not just identity).
///  2. `flow_token` — carries the verified wa_id once Phase 5's webhook starts a flow session by
///     signing one of these; this module only *verifies* it here since issuing it for a real
///     WhatsApp conversation is Phase 5's job.
export function signPayload<T extends object>(payload: T, secret: string, ttlMs: number): string {
  const withExpiry = { ...payload, exp: Date.now() + ttlMs };
  const encoded = Buffer.from(JSON.stringify(withExpiry)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyPayload<T>(token: string, secret: string): (T & { exp: number }) | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;

  const expectedBuf = Buffer.from(sign(encoded, secret));
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as T & { exp: unknown };
    if (typeof decoded.exp !== "number" || decoded.exp < Date.now()) return null;
    return decoded as T & { exp: number };
  } catch {
    return null;
  }
}
