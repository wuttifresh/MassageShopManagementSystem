import { NextResponse } from "next/server";
import { Channel } from "@/lib/booking-service";
import { getBookingLinkText, messageTriggersBooking } from "@/lib/channel-booking-adapter";
import { logNotification } from "@/lib/notification-log";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp-messaging";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp-webhook-auth";

// Verifies an HMAC signature (node:crypto) — never edge (coding rule #7).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: Array<{ from?: string; type?: string; text?: { body?: string } }> };
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

/// Phase 3 (channel adapter): a customer texting "จอง" gets a plain-text reply with the /book-now
/// link (src/lib/channel-booking-adapter.ts) — free-form text is deliverable here because it's a
/// direct reply within the 24-hour session window the customer's own inbound message just opened,
/// unlike the OTP/reminder cases elsewhere in this codebase that have to use approved templates.
///
/// This replaces the previous behavior of sending the WhatsApp Flow invite (sendWhatsAppFlowMessage)
/// on every inbound message — the Flow endpoint itself (src/app/api/whatsapp/flow, whatsapp-flow-screens.ts)
/// is untouched and still works if invited some other way; wiring Flows through services/booking-core
/// instead of calling booking-service.ts's createBooking directly is the deferred next step.
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

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.from || message.type !== "text" || !messageTriggersBooking(message.text?.body)) continue;

        const result = await sendWhatsAppTextMessage(message.from, getBookingLinkText());
        await logNotification({ channel: Channel.WHATSAPP, type: "BOOKING_LINK", recipient: message.from, result });
      }
    }
  }

  // Meta expects a fast 200 ack regardless of per-message outcomes — retrying the whole delivery
  // on a partial failure would just re-send the booking link to customers who already got it.
  return NextResponse.json({ ok: true });
}
