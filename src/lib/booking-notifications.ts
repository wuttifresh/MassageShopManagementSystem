import { Channel, type BookingCustomerIdentity, type CreatedBooking } from "@/lib/booking-service";
import { sendLineMessage } from "@/lib/line-messaging";
import { logNotification } from "@/lib/notification-log";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp-messaging";

function formatThaiDateTime(date: Date): string {
  return date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}

/// Sends the "your booking is confirmed" message back to whichever channel the customer actually
/// booked through (multi-channel-booking-prompt.md, Phase 5: "ส่งกลับ channel ที่ลูกค้าจองมา"),
/// and logs the attempt. Only for `customer.type === "channel"` (LINE LIFF / WhatsApp Flow) —
/// the pre-existing web/LINE-Login booking flow (src/app/book/actions.ts) already sends its own
/// confirmation and is intentionally left untouched here (see the Phase 5 checkpoint notes for why).
/// Never throws, matching sendLineMessage/sendWhatsAppTextMessage's own contract.
export async function notifyChannelBookingConfirmed(
  booking: CreatedBooking,
  customer: BookingCustomerIdentity,
  summary: { branchName: string; serviceName: string; durationMinutes: number }
): Promise<void> {
  if (customer.type !== "channel") return;

  const text = `ยืนยันการจองสำเร็จ ✅\nรหัสจอง: ${booking.code ?? "-"}\nบริการ: ${summary.serviceName} (${summary.durationMinutes} นาที)\nสาขา: ${summary.branchName}\nวันเวลา: ${formatThaiDateTime(booking.startTime)}`;

  const result =
    customer.channel === Channel.LINE
      ? await sendLineMessage(customer.channelUserId, text)
      : await sendWhatsAppTextMessage(customer.channelUserId, text);

  await logNotification({
    channel: customer.channel,
    type: "BOOKING_CONFIRMATION",
    recipient: customer.channelUserId,
    bookingId: booking.id,
    result,
  });
}
