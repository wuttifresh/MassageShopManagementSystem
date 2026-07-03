import { describe, expect, it, vi, beforeEach } from "vitest";

// Fully self-contained mock (no importOriginal) — booking-service.ts's own dependency chain
// (@/lib/prisma, @/lib/availability) isn't something this suite wants to exercise for real; it
// only needs to verify the screen router's own branching, state-token trust, and error mapping.
const { getBranches, getServices, getAvailableSlots, createBooking } = vi.hoisted(() => ({
  getBranches: vi.fn(),
  getServices: vi.fn(),
  getAvailableSlots: vi.fn(),
  createBooking: vi.fn(),
}));

vi.mock("@/lib/booking-service", () => {
  class BookingServiceError extends Error {}
  class SlotTakenError extends BookingServiceError {}
  class BookingValidationError extends BookingServiceError {}
  return {
    BookingServiceError,
    SlotTakenError,
    BookingValidationError,
    Channel: { LINE: "LINE", WHATSAPP: "WHATSAPP" },
    getBranches,
    getServices,
    getAvailableSlots,
    createBooking,
  };
});

import { SlotTakenError, BookingValidationError } from "@/lib/booking-service";
import { __resetRateLimitsForTests } from "@/lib/rate-limit";
import { signPayload } from "@/lib/whatsapp-flow-token";
import { FlowIdentityError, routeFlowAction } from "@/lib/whatsapp-flow-screens";

const SECRET = "test-secret";

function flowToken(waId = "66812345678") {
  return signPayload({ waId }, SECRET, 60_000);
}

function stateToken(state: Record<string, unknown>) {
  return signPayload(state, SECRET, 60_000);
}

const BRANCHES = [{ id: "branch-1", name: "สาขาสยาม" }];
const SERVICES = [
  {
    id: "svc-1",
    name: "นวดไทย",
    options: [{ id: "so-1", durationMinutes: 60, price: "400", promoPrice: null }],
  },
];

beforeEach(() => {
  getBranches.mockReset().mockResolvedValue(BRANCHES);
  getServices.mockReset().mockResolvedValue(SERVICES);
  getAvailableSlots.mockReset().mockResolvedValue([]);
  createBooking.mockReset();
  __resetRateLimitsForTests();
  process.env.WA_FLOW_TOKEN_SECRET = SECRET;
});

describe("routeFlowAction — ping / identity", () => {
  it("answers ping without requiring a flow_token", async () => {
    const result = await routeFlowAction({ action: "ping" });
    expect(result).toEqual({ data: { status: "active" } });
  });

  it("rejects INIT with no flow_token", async () => {
    await expect(routeFlowAction({ action: "INIT" })).rejects.toBeInstanceOf(FlowIdentityError);
  });

  it("rejects a flow_token signed with the wrong secret", async () => {
    const forged = signPayload({ waId: "0000000000" }, "wrong-secret", 60_000);
    await expect(routeFlowAction({ action: "INIT", flow_token: forged })).rejects.toBeInstanceOf(FlowIdentityError);
  });
});

describe("routeFlowAction — INIT", () => {
  it("returns SELECT_BRANCH with the branch list", async () => {
    const result = await routeFlowAction({ action: "INIT", flow_token: flowToken() });
    expect(result).toEqual({ screen: "SELECT_BRANCH", data: { branches: [{ id: "branch-1", title: "สาขาสยาม" }] } });
  });
});

describe("routeFlowAction — SELECT_BRANCH", () => {
  it("requires branch_id", async () => {
    await expect(
      routeFlowAction({ action: "data_exchange", screen: "SELECT_BRANCH", data: {}, flow_token: flowToken() })
    ).rejects.toBeInstanceOf(BookingValidationError);
  });

  it("advances to SELECT_SERVICE with a state_token carrying the branch", async () => {
    const result = await routeFlowAction({
      action: "data_exchange",
      screen: "SELECT_BRANCH",
      data: { branch_id: "branch-1" },
      flow_token: flowToken(),
    });
    expect(result).toMatchObject({ screen: "SELECT_SERVICE" });
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.services).toEqual([{ id: "so-1", title: "นวดไทย (60 นาที)", description: "฿400" }]);
    expect(typeof data.state_token).toBe("string");
  });
});

describe("routeFlowAction — SELECT_SERVICE", () => {
  it("rejects a missing/invalid state_token as an expired session", async () => {
    await expect(
      routeFlowAction({
        action: "data_exchange",
        screen: "SELECT_SERVICE",
        data: { service_option_id: "so-1" },
        flow_token: flowToken(),
      })
    ).rejects.toBeInstanceOf(FlowIdentityError);
  });

  it("advances to SELECT_DATETIME once a service is chosen", async () => {
    const result = await routeFlowAction({
      action: "data_exchange",
      screen: "SELECT_SERVICE",
      data: { service_option_id: "so-1", state_token: stateToken({ branchId: "branch-1" }) },
      flow_token: flowToken(),
    });
    expect(result).toMatchObject({ screen: "SELECT_DATETIME" });
    expect(getAvailableSlots).not.toHaveBeenCalled(); // no date chosen yet
  });
});

describe("routeFlowAction — SELECT_DATETIME", () => {
  const state = { branchId: "branch-1", serviceOptionId: "so-1" };

  it("refreshes the slot list (same screen) when the DatePicker triggers with only a date", async () => {
    getAvailableSlots.mockResolvedValue([new Date("2026-01-01T03:00:00.000Z")]);

    const result = await routeFlowAction({
      action: "data_exchange",
      screen: "SELECT_DATETIME",
      data: { date: "2026-01-01", state_token: stateToken(state) },
      flow_token: flowToken(),
    });

    expect(result).toMatchObject({ screen: "SELECT_DATETIME" });
    expect(getAvailableSlots).toHaveBeenCalledWith({ branchId: "branch-1", serviceOptionId: "so-1", date: new Date("2026-01-01") });
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.slots).toEqual([{ id: "03:00", title: "03:00" }]);
  });

  it("advances to CONFIRM once both date and time are chosen", async () => {
    const result = await routeFlowAction({
      action: "data_exchange",
      screen: "SELECT_DATETIME",
      data: { date: "2026-01-01", time: "10:00", state_token: stateToken(state) },
      flow_token: flowToken(),
    });

    expect(result).toEqual({
      screen: "CONFIRM",
      data: {
        summary_branch: "สาขาสยาม",
        summary_service: "นวดไทย (60 นาที)",
        summary_date: "2026-01-01",
        summary_time: "10:00",
        state_token: expect.any(String),
      },
    });
  });

  it("rejects a malformed date", async () => {
    await expect(
      routeFlowAction({
        action: "data_exchange",
        screen: "SELECT_DATETIME",
        data: { date: "not-a-date", state_token: stateToken(state) },
        flow_token: flowToken(),
      })
    ).rejects.toBeInstanceOf(BookingValidationError);
  });
});

describe("routeFlowAction — CONFIRM", () => {
  const state = { branchId: "branch-1", serviceOptionId: "so-1", date: "2026-01-01" };

  it("requires a name", async () => {
    await expect(
      routeFlowAction({
        action: "data_exchange",
        screen: "CONFIRM",
        data: { time: "10:00", state_token: stateToken(state) },
        flow_token: flowToken(),
      })
    ).rejects.toBeInstanceOf(BookingValidationError);
  });

  it("creates the booking with the flow_token's wa_id as the WhatsApp customer identity, never a client-supplied id", async () => {
    createBooking.mockResolvedValue({ id: "b-1", code: "BK-ABCD", startTime: new Date(), endTime: new Date(), therapistId: "t-1" });

    const result = await routeFlowAction({
      action: "data_exchange",
      screen: "CONFIRM",
      data: { name: "คุณสมชาย", time: "10:00", state_token: stateToken(state) },
      flow_token: flowToken("66899998888"),
    });

    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-1",
        serviceOptionId: "so-1",
        date: "2026-01-01",
        time: "10:00",
        customer: { type: "channel", channel: "WHATSAPP", channelUserId: "66899998888", name: "คุณสมชาย" },
      })
    );
    expect(result).toEqual({ screen: "SUCCESS", data: { booking_code: "BK-ABCD" } });
  });

  it("bounces back to SELECT_DATETIME with an error message when the slot was just taken", async () => {
    createBooking.mockRejectedValue(new SlotTakenError("ขออภัย ช่วงเวลานี้เพิ่งถูกจองไปแล้ว"));
    getAvailableSlots.mockResolvedValue([]);

    const result = await routeFlowAction({
      action: "data_exchange",
      screen: "CONFIRM",
      data: { name: "คุณสมชาย", time: "10:00", state_token: stateToken(state) },
      flow_token: flowToken(),
    });

    expect(result).toMatchObject({ screen: "SELECT_DATETIME" });
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.error_message).toBe("ขออภัย ช่วงเวลานี้เพิ่งถูกจองไปแล้ว");
  });

  it("rate-limits repeated confirm attempts from the same wa_id", async () => {
    createBooking.mockResolvedValue({ id: "b-1", code: "BK-ABCD", startTime: new Date(), endTime: new Date(), therapistId: "t-1" });
    const token = flowToken("66811112222");

    for (let i = 0; i < 5; i++) {
      await routeFlowAction({
        action: "data_exchange",
        screen: "CONFIRM",
        data: { name: "คุณสมชาย", time: "10:00", state_token: stateToken(state) },
        flow_token: token,
      });
    }

    await expect(
      routeFlowAction({
        action: "data_exchange",
        screen: "CONFIRM",
        data: { name: "คุณสมชาย", time: "10:00", state_token: stateToken(state) },
        flow_token: token,
      })
    ).rejects.toBeInstanceOf(BookingValidationError);
  });
});

describe("routeFlowAction — unknown routing", () => {
  it("rejects an unknown action", async () => {
    await expect(routeFlowAction({ action: "BACK", flow_token: flowToken() })).rejects.toBeInstanceOf(BookingValidationError);
  });

  it("rejects an unknown screen", async () => {
    await expect(
      routeFlowAction({ action: "data_exchange", screen: "NOT_A_SCREEN", data: {}, flow_token: flowToken() })
    ).rejects.toBeInstanceOf(BookingValidationError);
  });
});
