import { AuditAction } from "@/generated/prisma/client";
import type { Channel } from "@/lib/booking-service";
import { prisma } from "@/lib/prisma";
import type { SendResult } from "@/lib/send-result";

export type NotificationType = "BOOKING_CONFIRMATION" | "BOOKING_REMINDER" | "FLOW_INVITE";

export type NotificationLogInput = {
  channel: Channel;
  type: NotificationType;
  /// channelUserId / wa_id / LINE userId — the actual recipient, not a User/Customer row id.
  recipient: string;
  /// The booking this notification is about, if any (null for the initial "start a booking"
  /// prompt sent from a webhook, before any booking exists).
  bookingId?: string | null;
  result: SendResult;
};

/// Records every outbound multi-channel notification with its success/failure status
/// (multi-channel-booking-prompt.md, Phase 5, "ทุก outbound message ลง log พร้อม status").
/// Reuses AuditLog rather than a new table — see the AuditAction.SEND_NOTIFICATION doc comment in
/// schema.prisma for why. Never throws: losing an audit trail row must not break the notification
/// send (or the booking flow) it's attached to, matching sendLineMessage/sendWhatsApp*'s own
/// never-break-the-caller contract.
export async function logNotification(input: NotificationLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: AuditAction.SEND_NOTIFICATION,
        entityType: input.bookingId ? "Booking" : "ChannelIdentity",
        entityId: input.bookingId ?? input.recipient,
        metadata: {
          channel: input.channel,
          notificationType: input.type,
          recipient: input.recipient,
          status: input.result.ok ? "SENT" : "FAILED",
          error: input.result.ok ? null : input.result.error,
        },
      },
    });
  } catch (error) {
    console.error("[notification-log] failed to write audit log entry", error);
  }
}
