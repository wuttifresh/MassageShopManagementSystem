const LINE_VERIFY_ENDPOINT = "https://api.line.me/oauth2/v2.1/verify";

export type LineIdentity = { sub: string; name?: string; picture?: string };

/// Verifies a LINE ID token (from `liff.getIDToken()`) against LINE's own verification server —
/// never trust a channelUserId/sub claimed directly by the client (coding rule #5). LINE checks
/// the token's signature, expiry, and that `aud` matches our channel id; we only need to trust
/// its response, not re-derive any of that ourselves.
///
/// Returns null (never throws) for any failure — expired/invalid token, network error, or
/// missing configuration — so callers always get a clean "not authenticated" outcome.
export async function verifyLineIdToken(idToken: string): Promise<LineIdentity | null> {
  const clientId = process.env.LINE_CHANNEL_ID;
  if (!clientId) {
    console.error("[line-auth] LINE_CHANNEL_ID is not configured");
    return null;
  }
  if (!idToken) return null;

  try {
    const res = await fetch(LINE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });

    if (!res.ok) {
      console.error(`[line-auth] verify failed (${res.status}): ${await res.text()}`);
      return null;
    }

    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null || typeof (data as { sub?: unknown }).sub !== "string") {
      return null;
    }

    const { sub, name, picture } = data as { sub: string; name?: unknown; picture?: unknown };
    return {
      sub,
      name: typeof name === "string" ? name : undefined,
      picture: typeof picture === "string" ? picture : undefined,
    };
  } catch (error) {
    console.error("[line-auth] verify threw", error);
    return null;
  }
}
