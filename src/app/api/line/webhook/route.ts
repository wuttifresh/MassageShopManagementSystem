import { NextResponse } from "next/server";
import { Channel } from "@/lib/booking-service";
import { getBookingLinkUrl, messageTriggersBooking } from "@/lib/channel-booking-adapter";
import { sendLineReplyMessage } from "@/lib/line-messaging";
import { verifyLineWebhookSignature } from "@/lib/line-webhook-auth";
import { logNotification } from "@/lib/notification-log";

// Verifies an HMAC signature (node:crypto) — never edge (coding rule #7).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

type LineWebhookPayload = { events?: LineWebhookEvent[] };

function isLineWebhookPayload(value: unknown): value is LineWebhookPayload {
  return typeof value === "object" && value !== null;
}

/// The "start a booking" Flex Message, sent in reply whenever a customer texts something
/// containing "จอง" — points at /book-now (src/lib/channel-booking-adapter.ts, Phase 3).
/// Previously pointed at the LIFF booking page
/// (`https://liff.line.me/${NEXT_PUBLIC_LIFF_ID}`), which has been non-functional since LINE
/// Login/the /account portal were retired (see src/middleware.ts) — /book-now works for a LINE
/// user the same as anyone else, since it needs no account, just a phone number.
function buildBookingFlexMessage() {
  const url = getBookingLinkUrl();

  return {
    type: "flex",
    altText: "จองคิวนวด",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "จองคิวนวด", weight: "bold", size: "lg" },
          {
            type: "text",
            text: "กดปุ่มด้านล่างเพื่อเลือกสาขา บริการ และเวลาที่ต้องการ",
            wrap: true,
            margin: "md",
            size: "sm",
            color: "#666666",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "button", style: "primary", action: { type: "uri", label: "จองคิวเลย", uri: url } }],
      },
    },
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineWebhookSignature(rawBody, signature)) {
    return new NextResponse(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true }); // malformed body — ack anyway, nothing we can do with it
  }
  if (!isLineWebhookPayload(payload)) {
    return NextResponse.json({ ok: true });
  }

  for (const event of payload.events ?? []) {
    if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) continue;
    if (!messageTriggersBooking(event.message.text)) continue;

    const result = await sendLineReplyMessage(event.replyToken, [buildBookingFlexMessage()]);
    await logNotification({
      channel: Channel.LINE,
      type: "BOOKING_LINK",
      recipient: event.source?.userId ?? "unknown",
      result,
    });
  }

  // LINE expects a fast 200 ack regardless of per-event outcomes — retrying the whole delivery on
  // a partial failure would just re-send the Flex Message to customers who already got it.
  return NextResponse.json({ ok: true });
}
