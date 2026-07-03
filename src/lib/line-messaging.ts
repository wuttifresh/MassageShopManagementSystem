import type { SendResult } from "@/lib/send-result";

const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

/// Best-effort LINE push notification via the Messaging API (LINE Notify was shut down in
/// March 2025, so this is the only remaining way to message a LINE user proactively). Requires a
/// "Messaging API" channel under the same LINE Official Account as the "LINE Login" channel used
/// for customer auth (Phase 2) — a separate channel access token, not the login client secret.
///
/// Never throws: a failed/unconfigured notification must never break the booking or checkout flow
/// it's attached to. Logs instead, same graceful-degradation pattern as Supabase Realtime. Returns
/// a result (rather than void) so Phase 5's notification log can record success/failure — existing
/// callers that ignore the return value are unaffected.
export async function sendLineMessage(lineUserId: string, text: string): Promise<SendResult> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log(`[line-messaging] not configured, would have sent to ${lineUserId}: ${text}`);
    return { ok: false, error: "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not configured" };
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
      const body = await res.text();
      console.error(`[line-messaging] push failed (${res.status}): ${body}`);
      return { ok: false, error: `LINE push failed (${res.status}): ${body}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("[line-messaging] push threw", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/// Replies to a specific incoming message (via its replyToken) — used by the LINE webhook
/// (Phase 5) to answer a "จอง" text message with a Flex Message. Free within LINE's reply window,
/// unlike sendLineMessage's push API, and doesn't need the user to already have a linked account.
export async function sendLineReplyMessage(replyToken: string, messages: unknown[]): Promise<SendResult> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log(`[line-messaging] not configured, would have replied: ${JSON.stringify(messages)}`);
    return { ok: false, error: "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not configured" };
  }

  try {
    const res = await fetch(LINE_REPLY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[line-messaging] reply failed (${res.status}): ${body}`);
      return { ok: false, error: `LINE reply failed (${res.status}): ${body}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("[line-messaging] reply threw", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
