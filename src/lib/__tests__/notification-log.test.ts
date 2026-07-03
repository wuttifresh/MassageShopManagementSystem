import { describe, expect, it, vi, beforeEach } from "vitest";

const { auditLogCreate } = vi.hoisted(() => ({ auditLogCreate: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: auditLogCreate } } }));

import { logNotification } from "@/lib/notification-log";

beforeEach(() => {
  auditLogCreate.mockReset().mockResolvedValue({});
});

describe("logNotification", () => {
  it("logs a successful send with entityType Booking when a bookingId is given", async () => {
    await logNotification({
      channel: "LINE",
      type: "BOOKING_CONFIRMATION",
      recipient: "U1234",
      bookingId: "booking-1",
      result: { ok: true },
    });

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        action: "SEND_NOTIFICATION",
        entityType: "Booking",
        entityId: "booking-1",
        metadata: {
          channel: "LINE",
          notificationType: "BOOKING_CONFIRMATION",
          recipient: "U1234",
          status: "SENT",
          error: null,
        },
      },
    });
  });

  it("falls back to entityType ChannelIdentity keyed on the recipient when there's no booking yet", async () => {
    await logNotification({
      channel: "WHATSAPP",
      type: "FLOW_INVITE",
      recipient: "66812345678",
      result: { ok: false, error: "WhatsApp send failed (400): bad request" },
    });

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        action: "SEND_NOTIFICATION",
        entityType: "ChannelIdentity",
        entityId: "66812345678",
        metadata: {
          channel: "WHATSAPP",
          notificationType: "FLOW_INVITE",
          recipient: "66812345678",
          status: "FAILED",
          error: "WhatsApp send failed (400): bad request",
        },
      },
    });
  });

  it("never throws even if the database write fails", async () => {
    auditLogCreate.mockRejectedValue(new Error("db down"));

    await expect(
      logNotification({ channel: "LINE", type: "BOOKING_REMINDER", recipient: "U1", bookingId: "b1", result: { ok: true } })
    ).resolves.toBeUndefined();
  });
});
