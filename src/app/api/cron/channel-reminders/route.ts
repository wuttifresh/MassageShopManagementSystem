import { NextRequest, NextResponse } from "next/server";
import { Channel } from "@/generated/prisma/client";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sendLineMessage } from "@/lib/line-messaging";
import { logNotification } from "@/lib/notification-log";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp-messaging";

// Without this, Next.js would bake in a single prerendered response at build time — a cron
// endpoint must run fresh every invocation to see the current time and DB state.
export const dynamic = "force-dynamic";

/// Separate from the existing 30-minute /api/cron/reminders (which only covers the pre-existing
/// web/LINE-Login User-based bookings, unchanged — see Phase 5 checkpoint notes for why this
/// wasn't merged into that route instead). This one covers the new multi-channel Customer-linked
/// bookings, per multi-channel-booking-prompt.md Phase 5's "reminder ก่อนถึงคิว 2 ชั่วโมง".
const REMINDER_LEAD_MINUTES = 120;
const REMINDER_WINDOW_MINUTES = 10; // matches this route's cron cadence (see .github/workflows/reminders.yml)

function formatThaiTime(date: Date): string {
  return date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const windowStart = new Date(Date.now() + REMINDER_LEAD_MINUTES * 60_000);
  const windowEnd = new Date(windowStart.getTime() + REMINDER_WINDOW_MINUTES * 60_000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      deletedAt: null,
      reminderSentAt: null,
      startTime: { gte: windowStart, lte: windowEnd },
      channelCustomerId: { not: null },
    },
    include: { channelCustomer: true, branch: true, serviceOption: { include: { service: true } } },
  });

  let remindersSent = 0;
  for (const booking of bookings) {
    if (!booking.channelCustomer || !booking.channel) continue;
    const recipient = booking.channelCustomer.channelUserId;

    const result =
      booking.channel === Channel.LINE
        ? await sendLineMessage(
            recipient,
            `⏰ ใกล้ถึงเวลานัดของคุณแล้ว\nบริการ: ${booking.serviceOption.service.name}\nสาขา: ${booking.branch.name}\nเวลา: ${formatThaiTime(booking.startTime)}`
          )
        : await sendReminderTemplate(recipient, booking);

    await logNotification({ channel: booking.channel, type: "BOOKING_REMINDER", recipient, bookingId: booking.id, result });

    await prisma.booking.update({ where: { id: booking.id }, data: { reminderSentAt: new Date() } });
    remindersSent += 1;
  }

  return NextResponse.json({ remindersSent });
}

/// WhatsApp forbids free-form proactive messages outside the 24-hour customer-service window, so
/// unlike the LINE branch above, the 2-hour-ahead reminder must use a pre-approved "utility"
/// template (multi-channel-booking-prompt.md, Phase 5: "WhatsApp ใช้ utility template").
async function sendReminderTemplate(
  waId: string,
  booking: { branch: { name: string }; serviceOption: { service: { name: string } }; startTime: Date }
) {
  const templateName = process.env.WA_REMINDER_TEMPLATE_NAME;
  if (!templateName) {
    console.log(`[cron/channel-reminders] WA_REMINDER_TEMPLATE_NAME not configured, would have reminded ${waId}`);
    return { ok: false as const, error: "WA_REMINDER_TEMPLATE_NAME is not configured" };
  }

  const languageCode = process.env.WA_REMINDER_TEMPLATE_LANG || "th";
  return sendWhatsAppTemplateMessage(waId, templateName, languageCode, [
    booking.serviceOption.service.name,
    booking.branch.name,
    formatThaiTime(booking.startTime),
  ]);
}
