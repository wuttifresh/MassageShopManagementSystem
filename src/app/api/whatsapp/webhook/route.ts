import { NextResponse } from "next/server";
import { Channel } from "@/lib/booking-service";
import { logNotification } from "@/lib/notification-log";
import { sendWhatsAppFlowMessage } from "@/lib/whatsapp-messaging";
import { signPayload } from "@/lib/whatsapp-flow-token";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp-webhook-auth";

// Verifies an HMAC signature and mints signed flow_tokens (node:crypto) — never edge (coding rule #7).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generous enough to outlive how long a customer takes to work through the Flow (Phase 4's own
// intra-flow state_token uses 15 minutes; this is the outer session envelope around that).
const FLOW_TOKEN_TTL_MS = 30 * 60_000;

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: Array<{ from?: string; type?: string }> };
    }>;
  }>;
};

function isWhatsAppWebhookPayload(value: unknown): value is WhatsAppWebhookPayload {
  return typeof value === "object" && value !== null;
}

/// Meta's subscription handshake: called once when the webhook URL is configured in the App
/// Dashboard, and must echo back `hub.challenge` only if `hub.verify_token` matches our own secret.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WA_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && challenge && expectedToken && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse(null, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppWebhookSignature(rawBody, signature)) {
    return new NextResponse(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true }); // malformed body — ack anyway, nothing we can do with it
  }
  if (!isWhatsAppWebhookPayload(payload)) {
    return NextResponse.json({ ok: true });
  }

  const tokenSecret = process.env.WA_FLOW_TOKEN_SECRET;
  const flowId = process.env.WA_FLOW_ID;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.from || !tokenSecret || !flowId) continue;

        // The wa_id is trusted here because it comes from Meta's HMAC-signature-verified webhook
        // body (coding rule #5) — never something accepted from an unauthenticated request. We
        // sign it into the flow_token ourselves so the Flow endpoint (Phase 4) can later verify
        // whoever completes the Flow really is this same conversation.
        const flowToken = signPayload({ waId: message.from }, tokenSecret, FLOW_TOKEN_TTL_MS);
        const result = await sendWhatsAppFlowMessage(message.from, flowId, flowToken);

        await logNotification({ channel: Channel.WHATSAPP, type: "FLOW_INVITE", recipient: message.from, result });
      }
    }
  }

  // Meta expects a fast 200 ack regardless of per-message outcomes — retrying the whole delivery
  // on a partial failure would just re-send the Flow invite to customers who already got it.
  return NextResponse.json({ ok: true });
}
