import { BookingSource } from "@/generated/prisma/client";
import {
  BookingValidationError,
  Channel,
  SlotTakenError,
  createBooking,
  getAvailableSlots,
  getBranches,
  getServices,
} from "@/lib/booking-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { signPayload, verifyPayload } from "@/lib/whatsapp-flow-token";

/// Screen router for the WhatsApp Flow booking mini-app (multi-channel-booking-prompt.md, Phase
/// 4). Mirrors the LINE LIFF flow's steps (src/app/liff/booking) but driven by WhatsApp's
/// screen/data_exchange model instead of a React SPA: SELECT_BRANCH -> SELECT_SERVICE ->
/// SELECT_DATETIME -> CONFIRM -> SUCCESS. The actual booking creation goes through the same
/// channel-agnostic src/lib/booking-service.ts used by the web flow and the LINE API.

const STATE_TOKEN_TTL_MS = 15 * 60_000; // must complete the whole flow within 15 minutes
const CREATE_BOOKING_LIMIT = 5;
const CREATE_BOOKING_WINDOW_MS = 5 * 60_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_WINDOW_DAYS = 14;

export class FlowIdentityError extends BookingValidationError {}

type FlowState = {
  branchId?: string;
  serviceOptionId?: string;
  date?: string;
};

type FlowIdentity = { waId: string };

export type FlowActionRequest = {
  version?: string;
  action: string;
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
};

export type FlowActionResponse = { screen: string; data: Record<string, unknown> } | { data: Record<string, unknown> };

function stateSecret(): string {
  const secret = process.env.WA_FLOW_TOKEN_SECRET;
  if (!secret) throw new Error("WA_FLOW_TOKEN_SECRET is not configured");
  return secret;
}

function signState(state: FlowState): string {
  return signPayload(state, stateSecret(), STATE_TOKEN_TTL_MS);
}

function readState(token: unknown): FlowState {
  if (typeof token !== "string") return {};
  const decoded = verifyPayload<FlowState>(token, stateSecret());
  return decoded ?? {};
}

/// The wa_id behind this flow session — trusted only because it comes from a `flow_token` *we*
/// signed when the flow was started, never from anything else in the request body (coding rule
/// #5). Issuing a real one for a live WhatsApp conversation is Phase 5's job (the webhook that
/// sends the interactive flow message); until then, tests/manual testing mint tokens with the
/// same signPayload() helper to simulate what Phase 5 will produce.
function resolveIdentity(flowToken: unknown): FlowIdentity | null {
  if (typeof flowToken !== "string" || !flowToken) return null;
  return verifyPayload<FlowIdentity>(flowToken, stateSecret());
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function dateWindow(): { minDate: string; maxDate: string } {
  return { minDate: isoDate(new Date()), maxDate: isoDate(new Date(Date.now() + SLOT_WINDOW_DAYS * 86_400_000)) };
}

async function slotScreenData(branchId: string, serviceOptionId: string, date: string | undefined, errorMessage?: string) {
  const { minDate, maxDate } = dateWindow();
  const slots = date ? await getAvailableSlots({ branchId, serviceOptionId, date: new Date(date) }) : [];
  return {
    min_date: minDate,
    max_date: maxDate,
    slots: slots.map((s) => ({ id: formatTime(s), title: formatTime(s) })),
    state_token: signState({ branchId, serviceOptionId, date }),
    ...(errorMessage ? { error_message: errorMessage } : {}),
  };
}

export async function routeFlowAction(request: FlowActionRequest): Promise<FlowActionResponse> {
  if (request.action === "ping") {
    return { data: { status: "active" } };
  }

  const identity = resolveIdentity(request.flow_token);
  if (!identity) {
    throw new FlowIdentityError("ยืนยันตัวตนไม่สำเร็จ กรุณาเริ่มการจองใหม่อีกครั้งจากแชท");
  }

  if (request.action === "INIT") {
    const branches = await getBranches();
    return {
      screen: "SELECT_BRANCH",
      data: { branches: branches.map((b) => ({ id: b.id, title: b.name })) },
    };
  }

  if (request.action === "data_exchange") {
    return routeDataExchange(request, identity);
  }

  throw new BookingValidationError(`ไม่รู้จัก action: ${request.action}`);
}

async function routeDataExchange(request: FlowActionRequest, identity: FlowIdentity): Promise<FlowActionResponse> {
  const data = request.data ?? {};

  switch (request.screen) {
    case "SELECT_BRANCH": {
      if (!isNonEmptyString(data.branch_id)) throw new BookingValidationError("กรุณาเลือกสาขา");

      const services = await getServices();
      return {
        screen: "SELECT_SERVICE",
        data: {
          services: services.flatMap((s) =>
            s.options.map((o) => ({
              id: o.id,
              title: `${s.name} (${o.durationMinutes} นาที)`,
              description: o.promoPrice ? `฿${o.promoPrice} (ปกติ ฿${o.price})` : `฿${o.price}`,
            }))
          ),
          state_token: signState({ branchId: data.branch_id }),
        },
      };
    }

    case "SELECT_SERVICE": {
      const state = readState(data.state_token);
      if (!state.branchId) throw new FlowIdentityError("เซสชันหมดอายุ กรุณาเริ่มการจองใหม่อีกครั้ง");
      if (!isNonEmptyString(data.service_option_id)) throw new BookingValidationError("กรุณาเลือกบริการ");

      return {
        screen: "SELECT_DATETIME",
        data: await slotScreenData(state.branchId, data.service_option_id, undefined),
      };
    }

    // Both the DatePicker's on-select-action (refresh slots for a newly picked date) and the
    // Footer's "next" action (date + time both chosen) submit from this same screen — the
    // presence of `time` is what tells them apart.
    case "SELECT_DATETIME": {
      const state = readState(data.state_token);
      if (!state.branchId || !state.serviceOptionId) {
        throw new FlowIdentityError("เซสชันหมดอายุ กรุณาเริ่มการจองใหม่อีกครั้ง");
      }
      if (!isNonEmptyString(data.date) || !DATE_PATTERN.test(data.date)) {
        throw new BookingValidationError("กรุณาเลือกวันที่");
      }

      if (!isNonEmptyString(data.time)) {
        return {
          screen: "SELECT_DATETIME",
          data: await slotScreenData(state.branchId, state.serviceOptionId, data.date),
        };
      }

      const [branches, services] = await Promise.all([getBranches(), getServices()]);
      const branch = branches.find((b) => b.id === state.branchId);
      const serviceOption = services.flatMap((s) => s.options.map((o) => ({ ...o, serviceName: s.name }))).find((o) => o.id === state.serviceOptionId);
      if (!branch || !serviceOption) throw new BookingValidationError("ไม่พบข้อมูลสาขาหรือบริการที่เลือก");

      return {
        screen: "CONFIRM",
        data: {
          summary_branch: branch.name,
          summary_service: `${serviceOption.serviceName} (${serviceOption.durationMinutes} นาที)`,
          summary_date: data.date,
          summary_time: data.time,
          state_token: signState({ branchId: state.branchId, serviceOptionId: state.serviceOptionId, date: data.date }),
        },
      };
    }

    case "CONFIRM": {
      const state = readState(data.state_token);
      if (!state.branchId || !state.serviceOptionId || !state.date) {
        throw new FlowIdentityError("เซสชันหมดอายุ กรุณาเริ่มการจองใหม่อีกครั้ง");
      }
      if (!isNonEmptyString(data.name)) throw new BookingValidationError("กรุณากรอกชื่อผู้จอง");
      if (!isNonEmptyString(data.time)) throw new BookingValidationError("กรุณาเลือกเวลา");

      const rateLimit = checkRateLimit(`create-booking:whatsapp:${identity.waId}`, CREATE_BOOKING_LIMIT, CREATE_BOOKING_WINDOW_MS);
      if (!rateLimit.allowed) {
        throw new BookingValidationError("คุณทำรายการจองบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่");
      }

      try {
        const booking = await createBooking({
          branchId: state.branchId,
          serviceOptionId: state.serviceOptionId,
          therapistId: null,
          date: state.date,
          time: data.time,
          source: BookingSource.ONLINE,
          customer: { type: "channel", channel: Channel.WHATSAPP, channelUserId: identity.waId, name: data.name },
        });

        return { screen: "SUCCESS", data: { booking_code: booking.code ?? "" } };
      } catch (error) {
        if (error instanceof SlotTakenError) {
          // Per spec: bounce back to SELECT_DATETIME with an error message rather than a hard
          // failure, and refresh the slot list since the one the customer picked is now gone.
          return {
            screen: "SELECT_DATETIME",
            data: await slotScreenData(state.branchId, state.serviceOptionId, state.date, error.message),
          };
        }
        throw error;
      }
    }

    default:
      throw new BookingValidationError(`ไม่รู้จักหน้าจอ: ${String(request.screen)}`);
  }
}
