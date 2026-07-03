import type { SendResult } from "@/lib/send-result";

const GRAPH_API_VERSION = "v20.0";

function endpoint(): string | null {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  return phoneNumberId ? `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages` : null;
}

/// Never throws — a failed/unconfigured notification must never break the booking flow or cron
/// job it's attached to, same graceful-degradation pattern as sendLineMessage. Returns a result
/// instead so callers can log success/failure (multi-channel-booking-prompt.md, Phase 5).
async function sendWhatsAppPayload(payload: Record<string, unknown>): Promise<SendResult> {
  const token = process.env.WA_MESSAGING_ACCESS_TOKEN;
  const url = endpoint();
  if (!token || !url) {
    console.log(`[whatsapp-messaging] not configured, would have sent: ${JSON.stringify(payload)}`);
    return { ok: false, error: "WA_MESSAGING_ACCESS_TOKEN/WA_PHONE_NUMBER_ID is not configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[whatsapp-messaging] send failed (${res.status}): ${body}`);
      return { ok: false, error: `WhatsApp send failed (${res.status}): ${body}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("[whatsapp-messaging] send threw", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/// Free-form text message — only deliverable within Meta's 24-hour customer-service window (i.e.
/// shortly after the customer last messaged us, such as right after they finish a Flow). Used for
/// booking confirmations; never for the 2-hour-ahead reminder, which needs a template instead.
export async function sendWhatsAppTextMessage(waId: string, text: string): Promise<SendResult> {
  return sendWhatsAppPayload({ to: waId, type: "text", text: { body: text } });
}

/// A pre-approved WhatsApp "utility" template message — the only way to message a customer
/// proactively outside the 24-hour session window. `templateName`/`languageCode` must match a
/// template already approved in WhatsApp Manager; `bodyParams` fill its {{1}}, {{2}}, ... in order.
export async function sendWhatsAppTemplateMessage(
  waId: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<SendResult> {
  return sendWhatsAppPayload({
    to: waId,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }],
    },
  });
}

/// Sends the interactive message that opens our booking Flow (whatsapp/booking-flow.json,
/// Phase 4) — `flowToken` must be an HMAC-signed token from whatsapp-flow-token.ts binding this
/// session to the customer's wa_id (coding rule #5: never let the client supply its own identity).
export async function sendWhatsAppFlowMessage(waId: string, flowId: string, flowToken: string): Promise<SendResult> {
  return sendWhatsAppPayload({
    to: waId,
    type: "interactive",
    interactive: {
      type: "flow",
      body: { text: "จองคิวนวดได้ง่ายๆ กดปุ่มด้านล่างเพื่อเริ่มการจอง" },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: flowToken,
          flow_id: flowId,
          flow_cta: "จองคิวนวด",
          flow_action: "navigate",
          flow_action_payload: { screen: "SELECT_BRANCH" },
        },
      },
    },
  });
}
