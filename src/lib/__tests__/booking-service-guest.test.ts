import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  bookingFindFirst,
  bookingFindUnique,
  bookingUpdate,
  transactionMock,
  serviceOptionFindUnique,
  branchFindUnique,
  findAvailableTherapist,
} = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  transactionMock: vi.fn(),
  serviceOptionFindUnique: vi.fn(),
  branchFindUnique: vi.fn(),
  findAvailableTherapist: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findFirst: bookingFindFirst, findUnique: bookingFindUnique, update: bookingUpdate },
    serviceOption: { findUnique: serviceOptionFindUnique },
    branch: { findUnique: branchFindUnique },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/availability", () => ({
  findAvailableTherapist,
  getAnyTherapistSlots: vi.fn(),
  getTherapistSlots: vi.fn(),
}));

import {
  cancelGuestBooking,
  findGuestBooking,
  rescheduleGuestBooking,
  Channel,
} from "@/lib/booking-service";

function tomorrow(): string {
  const d = new Date(Date.now() + 24 * 60 * 60_000);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  bookingFindFirst.mockReset();
  bookingFindUnique.mockReset();
  bookingUpdate.mockReset();
  transactionMock.mockReset();
  serviceOptionFindUnique.mockReset();
  branchFindUnique.mockReset();
  findAvailableTherapist.mockReset();
});

describe("findGuestBooking", () => {
  it("queries by code + channel WEB + the channel customer's phone", async () => {
    bookingFindFirst.mockResolvedValue({ id: "b1" });
    await findGuestBooking("BK-TEST", "+66812345678");

    expect(bookingFindFirst).toHaveBeenCalledWith({
      where: {
        code: "BK-TEST",
        channel: Channel.WEB,
        deletedAt: null,
        channelCustomer: { channelUserId: "+66812345678" },
      },
      include: expect.any(Object),
    });
  });
});

describe("cancelGuestBooking", () => {
  it("returns an error when no booking matches the phone", async () => {
    bookingFindUnique.mockResolvedValue(null);
    const result = await cancelGuestBooking("b1", "+66812345678");
    expect(result).toEqual({ success: false, error: "ไม่พบการจองนี้", notFound: true });
  });

  it("returns an error when the booking belongs to a different phone", async () => {
    bookingFindUnique.mockResolvedValue({
      id: "b1",
      deletedAt: null,
      channel: Channel.WEB,
      channelCustomer: { channelUserId: "+66899999999" },
      status: "CONFIRMED",
    });
    const result = await cancelGuestBooking("b1", "+66812345678");
    expect(result).toEqual({ success: false, error: "ไม่พบการจองนี้", notFound: true });
  });

  it("returns an error when the booking isn't in a cancellable status", async () => {
    bookingFindUnique.mockResolvedValue({
      id: "b1",
      deletedAt: null,
      channel: Channel.WEB,
      channelCustomer: { channelUserId: "+66812345678" },
      status: "COMPLETED",
    });
    const result = await cancelGuestBooking("b1", "+66812345678");
    expect(result.success).toBe(false);
  });

  it("cancels and writes an audit log when everything matches", async () => {
    bookingFindUnique.mockResolvedValue({
      id: "b1",
      branchId: "branch-1",
      deletedAt: null,
      channel: Channel.WEB,
      channelCustomer: { channelUserId: "+66812345678" },
      channelCustomerId: "cust-1",
      status: "CONFIRMED",
    });
    const tx = { booking: { update: vi.fn() }, auditLog: { create: vi.fn() } };
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const result = await cancelGuestBooking("b1", "+66812345678");

    expect(result).toEqual({ success: true, data: undefined });
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1" }, data: expect.objectContaining({ status: "CANCELLED" }) })
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});

describe("rescheduleGuestBooking", () => {
  const OWNED_BOOKING = {
    id: "b1",
    branchId: "branch-1",
    serviceOptionId: "so-1",
    therapistId: "therapist-1",
    source: "ONLINE",
    deletedAt: null,
    channel: Channel.WEB,
    channelCustomer: { channelUserId: "+66812345678", name: "สมชาย" },
    status: "CONFIRMED",
  };

  it("returns an error when the booking doesn't belong to this phone", async () => {
    bookingFindUnique.mockResolvedValue(null);
    const result = await rescheduleGuestBooking("b1", "+66812345678", tomorrow(), "10:00");
    expect(result).toEqual({ success: false, error: "ไม่พบการจองนี้", notFound: true });
  });

  it("creates a replacement booking via createBooking and marks the old one superseded", async () => {
    bookingFindUnique.mockResolvedValue(OWNED_BOOKING);
    serviceOptionFindUnique.mockResolvedValue({ id: "so-1", serviceId: "svc-1", durationMinutes: 60, isActive: true });
    branchFindUnique.mockResolvedValue({ id: "branch-1" });
    findAvailableTherapist.mockResolvedValue("therapist-1");

    const tx = {
      customer: { upsert: vi.fn().mockResolvedValue({ id: "cust-1" }) },
      booking: {
        create: vi.fn().mockResolvedValue({
          id: "b2",
          code: "BK-NEW1",
          startTime: new Date(),
          endTime: new Date(),
          therapistId: "therapist-1",
        }),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const result = await rescheduleGuestBooking("b1", "+66812345678", tomorrow(), "10:00");

    expect(result).toEqual({ success: true, data: expect.objectContaining({ id: "b2", code: "BK-NEW1" }) });
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rescheduledFromId: "b1" }) })
    );
    expect(tx.booking.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { status: "RESCHEDULED" } });
  });

  it("surfaces SlotTakenError as a normal failure result instead of throwing", async () => {
    bookingFindUnique.mockResolvedValue(OWNED_BOOKING);
    serviceOptionFindUnique.mockResolvedValue({ id: "so-1", serviceId: "svc-1", durationMinutes: 60, isActive: true });
    branchFindUnique.mockResolvedValue({ id: "branch-1" });
    findAvailableTherapist.mockResolvedValue(null); // preferred therapist not free at the new time

    const result = await rescheduleGuestBooking("b1", "+66812345678", tomorrow(), "10:00");
    expect(result.success).toBe(false);
  });
});
