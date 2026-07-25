/// Shared "start a booking" reply logic for every messaging-channel webhook (WhatsApp, LINE) —
/// Phase 3 of the Go migration plan. Deliberately channel-agnostic: it only decides *whether* an
/// inbound text should trigger a reply and *what URL/copy* that reply points at. Each webhook
/// route still owns its own signature verification and its own channel-specific message format
/// (WhatsApp free-form text vs. LINE's Flex Message bubble) — this module exists so that decision
/// isn't duplicated per channel, and so LINE and WhatsApp react to the exact same trigger.
///
/// This is the "เริ่มจากวิธีส่งลิงก์จองในแชต" step: point the customer at /book-now (Phase 2's
/// public, no-login booking page) instead of creating a booking directly here. Neither this module
/// nor the webhooks it's used from call services/booking-core (Phase 1) yet — there's no booking
/// being created at this step, just a link being sent. Wiring WhatsApp Flows (src/lib/whatsapp-flow-screens.ts,
/// still calling booking-service.ts's createBooking directly, untouched by this phase) through
/// booking-core instead is the deferred "ต่อ WhatsApp Flows" step.

export const BOOKING_TRIGGER_KEYWORD = "จอง";

export function messageTriggersBooking(text: string | undefined | null): boolean {
  return typeof text === "string" && text.includes(BOOKING_TRIGGER_KEYWORD);
}

/// The single /book-now URL every channel's "start a booking" reply points at — no per-branch or
/// per-service preselection here (see /dashboard/booking-links, Phase 2, for that), since a
/// webhook has no way to know which branch a given WhatsApp/LINE conversation is about.
export function getBookingLinkUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? "";
  return `${base.replace(/\/+$/, "")}/book-now`;
}

export function getBookingLinkText(): string {
  return `จองคิวนวดได้ง่ายๆ กดลิงก์นี้เลยค่ะ 👇\n${getBookingLinkUrl()}`;
}
