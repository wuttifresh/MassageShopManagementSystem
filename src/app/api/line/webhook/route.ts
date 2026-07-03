import { NextResponse } from "next/server";
import { Channel } from "@/lib/booking-service";
import { sendLineReplyMessage } from "@/lib/line-messaging";
import { verifyLineWebhookSignature } from "@/lib/line-webhook-auth";
import { logNotification } from "@/lib/notification-log";

// Verifies an HMAC signature (node:crypto) — never edge (coding rule #7).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKING_KEYWORD = "จอง";

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

/// The "start a booking" Flex Message with a button that opens the LIFF page (Phase 3) — sent in
/// reply whenever a customer texts something containing "จอง" (multi-channel-booking-prompt.md,
/// Phase 5: 'ลูกค้าพิมพ์ "จอง" -> ตอบ Flex Message พร้อมปุ่มเปิด LIFF').
function buildBookingFlexMessage() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const liffUrl = liffId ? `https://liff.line.me/${liffId}` : "https://liff.line.me/";

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
        contents: [{ type: "button", style: "primary", action: { type: "uri", label: "จองคิวเลย", uri: liffUrl } }],
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
    if (!event.message.text?.includes(BOOKING_KEYWORD)) continue;

    const result = await sendLineReplyMessage(event.replyToken, [buildBookingFlexMessage()]);
    await logNotification({
      channel: Channel.LINE,
      type: "FLOW_INVITE",
      recipient: event.source?.userId ?? "unknown",
      result,
    });
  }

  // LINE expects a fast 200 ack regardless of per-event outcomes — retrying the whole delivery on
  // a partial failure would just re-send the Flex Message to customers who already got it.
  return NextResponse.json({ ok: true });
}
