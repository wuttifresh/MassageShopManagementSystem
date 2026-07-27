import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendLineMessage, logNotification } = vi.hoisted(() => ({
  sendLineMessage: vi.fn(),
  logNotification: vi.fn(),
}));

vi.mock("@/lib/line-messaging", () => ({ sendLineMessage }));
vi.mock("@/lib/notification-log", () => ({ logNotification }));

import { notifyChannelBookingConfirmed } from "@/lib/booking-notifications";

const BOOKING = { id: "booking-1", code: "BK-ABCD", startTime: new Date("2026-01-01T03:00:00.000Z"), endTime: new Date(), therapistId: null };
const SUMMARY = { branchName: "สาขาสยาม", serviceName: "นวดไทย", durationMinutes: 60 };

beforeEach(() => {
  sendLineMessage.mockReset().mockResolvedValue({ ok: true });
  logNotification.mockReset();
});

describe("notifyChannelBookingConfirmed", () => {
  it("does nothing for a User-identity (existing web/LINE-Login) booking — that flow has its own notification", async () => {
    await notifyChannelBookingConfirmed(BOOKING, { type: "user", userId: "user-1" }, SUMMARY);

    expect(sendLineMessage).not.toHaveBeenCalled();
    expect(logNotification).not.toHaveBeenCalled();
  });

  it("sends via LINE push and logs it for a LINE channel identity", async () => {
    await notifyChannelBookingConfirmed(
      BOOKING,
      { type: "channel", channel: "LINE", channelUserId: "U1234", name: "คุณสมชาย" },
      SUMMARY
    );

    expect(sendLineMessage).toHaveBeenCalledWith("U1234", expect.stringContaining("BK-ABCD"));
    expect(logNotification).toHaveBeenCalledWith({
      channel: "LINE",
      type: "BOOKING_CONFIRMATION",
      recipient: "U1234",
      bookingId: "booking-1",
      result: { ok: true },
    });
  });

  it("logs a failed send with its error message", async () => {
    sendLineMessage.mockResolvedValue({ ok: false, error: "LINE push failed (400): bad request" });

    await notifyChannelBookingConfirmed(
      BOOKING,
      { type: "channel", channel: "LINE", channelUserId: "U1234", name: "คุณสมชาย" },
      SUMMARY
    );

    expect(logNotification).toHaveBeenCalledWith(
      expect.objectContaining({ result: { ok: false, error: "LINE push failed (400): bad request" } })
    );
  });
});
