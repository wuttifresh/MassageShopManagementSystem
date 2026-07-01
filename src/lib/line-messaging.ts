const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

/// Best-effort LINE push notification via the Messaging API (LINE Notify was shut down in
/// March 2025, so this is the only remaining way to message a LINE user proactively). Requires a
/// "Messaging API" channel under the same LINE Official Account as the "LINE Login" channel used
/// for customer auth (Phase 2) — a separate channel access token, not the login client secret.
///
/// Never throws: a failed/unconfigured notification must never break the booking or checkout flow
/// it's attached to. Logs instead, same graceful-degradation pattern as Supabase Realtime.
export async function sendLineMessage(lineUserId: string, text: string): Promise<void> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log(`[line-messaging] not configured, would have sent to ${lineUserId}: ${text}`);
    return;
  }

  try {
    const res = await fetch(LINE_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      console.error(`[line-messaging] push failed (${res.status}): ${await res.text()}`);
    }
  } catch (error) {
    console.error("[line-messaging] push threw", error);
  }
}
