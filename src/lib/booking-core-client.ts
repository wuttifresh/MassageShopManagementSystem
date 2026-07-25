import { BookingValidationError, SlotTakenError } from "@/lib/booking-service";

/// Thin HTTP client for services/booking-core (the Go/Fiber Phase 1 service) — /book-now's
/// availability query and booking creation go through here instead of the TypeScript
/// booking-service.ts, per the Phase 2 plan. Throws the same SlotTakenError/BookingValidationError
/// classes booking-service.ts does, so callers (API routes) don't need to know which backend
/// actually served the request.

function baseUrl(): string {
  const url = process.env.BOOKING_CORE_URL;
  if (!url) throw new Error("BOOKING_CORE_URL is not configured");
  return url.replace(/\/$/, "");
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : `booking-core request failed (${res.status})`;
  } catch {
    return `booking-core request failed (${res.status})`;
  }
}

export type GetAvailabilityFromCoreInput = {
  branchId: string;
  serviceOptionId: string;
  /// Omit / null for "คนไหนก็ได้" — union of every eligible therapist's free slots.
  therapistId?: string | null;
  date: string; // YYYY-MM-DD
};

/// Returns free start times as "HH:mm" strings — same shape /api/availability already returns,
/// so callers don't need to reformat anything when switching backends.
export async function getAvailabilityFromCore(input: GetAvailabilityFromCoreInput): Promise<string[]> {
  const search = new URLSearchParams({
    branchId: input.branchId,
    serviceOptionId: input.serviceOptionId,
    date: input.date,
  });
  if (input.therapistId) search.set("therapistId", input.therapistId);

  const res = await fetch(`${baseUrl()}/v1/availability?${search.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseErrorMessage(res));

  const data = (await res.json()) as { slots: string[] };
  return data.slots;
}

/// Mirrors BookingCustomerIdentity's "channel" variant in booking-service.ts (channel + channelUserId
/// set together = upsert a channel-linked Customer; omitted = the legacy guest_name/guest_phone path).
export type BookingCoreCustomer = {
  channel?: string;
  channelUserId?: string;
  name: string;
  phone?: string | null;
};

export type CreateBookingViaCoreInput = {
  branchId: string;
  serviceOptionId: string;
  /// null = "คนไหนก็ได้" (any available therapist).
  therapistId: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  source: string;
  customer: BookingCoreCustomer;
};

export type CreatedBookingFromCore = {
  id: string;
  code: string | null;
  startTime: Date;
  endTime: Date;
};

export async function createBookingViaCore(input: CreateBookingViaCoreInput): Promise<CreatedBookingFromCore> {
  const res = await fetch(`${baseUrl()}/v1/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: input.branchId,
      serviceOptionId: input.serviceOptionId,
      therapistId: input.therapistId ?? "",
      date: input.date,
      time: input.time,
      source: input.source,
      channel: input.customer.channel ?? "",
      channelUserId: input.customer.channelUserId ?? "",
      guestName: input.customer.name,
      guestPhone: input.customer.phone ?? null,
    }),
  });

  if (res.status === 409) throw new SlotTakenError(await parseErrorMessage(res));
  if (res.status === 400) throw new BookingValidationError(await parseErrorMessage(res));
  if (!res.ok) throw new Error(await parseErrorMessage(res));

  const data = (await res.json()) as { bookingId: string; code: string | null; startTime: string; endTime: string };
  return {
    id: data.bookingId,
    code: data.code,
    startTime: new Date(data.startTime),
    endTime: new Date(data.endTime),
  };
}
