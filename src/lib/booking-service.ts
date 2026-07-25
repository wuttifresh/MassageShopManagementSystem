import { Channel, BookingStatus, type BookingSource } from "@/generated/prisma/client";
import { isDriverAdapterError } from "@prisma/driver-adapter-utils";
import { prisma } from "@/lib/prisma";
import { findAvailableTherapist, getAnyTherapistSlots, getTherapistSlots } from "@/lib/availability";

/// Channel-agnostic booking service (see multi-channel-booking-prompt.md, Phase 1). Both the
/// existing web booking flow (src/app/book/actions.ts) and the future LINE/WhatsApp entry points
/// call through here, so overlap protection, customer resolution, and audit logging only exist
/// in one place. Verifying *who* the caller is (NextAuth session, LINE ID token, WhatsApp signed
/// payload) happens in the caller — this module only ever receives an already-trusted identity.

const MAX_SLOTS = 50;
const BOOKING_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I — avoids ambiguity
const POSTGRES_EXCLUSION_VIOLATION = "23P01";
const POSTGRES_UNIQUE_VIOLATION = "23505";
const MAX_CODE_ATTEMPTS = 5;

export class BookingServiceError extends Error {}

/// Thrown when the requested slot is no longer available — either the app-level availability
/// check found no free therapist, or (more importantly) the database's EXCLUDE constraint
/// rejected a race-condition double-booking that slipped past that check. Callers map this to
/// HTTP 409 / a "เลือกเวลาอื่น" prompt, not a generic error.
export class SlotTakenError extends BookingServiceError {}

/// Bad input that the caller should have validated (missing/unknown branch, service, etc.) —
/// distinct from SlotTakenError so callers can map it to HTTP 400 instead of 409.
export class BookingValidationError extends BookingServiceError {}

export async function getBranches() {
  return prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, slug: true, address: true, openTime: true, closeTime: true },
    orderBy: { name: "asc" },
  });
}

/// NOTE: Service is a shared catalog entry, not branch-scoped in this schema (see
/// Service's doc comment in schema.prisma) — there is no per-branch service list or `sortOrder`
/// field to sort by, so this intentionally doesn't take a `branchId` param and sorts by name,
/// matching the existing /api/services route exactly.
export async function getServices() {
  return prisma.service.findMany({
    where: { isActive: true, deletedAt: null, options: { some: { isActive: true } } },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      options: {
        where: { isActive: true },
        select: { id: true, durationMinutes: true, price: true, promoPrice: true },
        orderBy: { durationMinutes: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export type GetAvailableSlotsInput = {
  branchId: string;
  serviceOptionId: string;
  date: Date;
  /// Omit / null for "คนไหนก็ได้" — union of every eligible therapist's free slots.
  therapistId?: string | null;
};

/// Free start times for a given branch/service option/date, already filtered to the future and
/// capped at MAX_SLOTS. Delegates the actual per-therapist schedule/overlap math to
/// src/lib/availability.ts (existing, unchanged) rather than recomputing it here.
export async function getAvailableSlots(input: GetAvailableSlotsInput): Promise<Date[]> {
  const serviceOption = await prisma.serviceOption.findUnique({
    where: { id: input.serviceOptionId, isActive: true },
  });
  if (!serviceOption) throw new BookingValidationError("ไม่พบบริการที่เลือก");

  const slots = input.therapistId
    ? await getTherapistSlots(input.therapistId, input.date, serviceOption.durationMinutes)
    : await getAnyTherapistSlots(input.branchId, serviceOption.serviceId, input.date, serviceOption.durationMinutes);

  return slots.slice(0, MAX_SLOTS);
}

/// Resolves to an already-existing `User` customer (the current web flow, authenticated via
/// NextAuth) or upserts a `Customer` row for a new multi-channel booking (LINE LIFF / WhatsApp),
/// keyed by the unique (channel, channelUserId) pair — never both.
export type BookingCustomerIdentity =
  | { type: "user"; userId: string }
  | { type: "channel"; channel: Channel; channelUserId: string; name: string; phone?: string | null };

export type CreateBookingInput = {
  branchId: string;
  serviceOptionId: string;
  /// null = customer picked "คนไหนก็ได้" (any available therapist)
  therapistId: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  source: BookingSource;
  customer: BookingCustomerIdentity;
  /// Staff/admin-created bookings only; null for self-service bookings.
  createdById?: string | null;
  /// Set when this call is *replacing* an existing booking (a reschedule) rather than a fresh
  /// request — see rescheduleGuestBooking below. The superseded booking is marked RESCHEDULED in
  /// the same transaction as the new booking's insert, so a crash between the two can't happen.
  supersededBookingId?: string | null;
};

export type CreatedBooking = {
  id: string;
  code: string | null;
  startTime: Date;
  endTime: Date;
  therapistId: string | null;
};

function combineDateAndTime(date: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setUTCHours(hours, minutes, 0, 0);
  return combined;
}

function generateBookingCode(): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += BOOKING_CODE_ALPHABET[Math.floor(Math.random() * BOOKING_CODE_ALPHABET.length)];
  }
  return `BK-${suffix}`;
}

function isExclusionViolation(error: unknown): boolean {
  return (
    isDriverAdapterError(error) && error.cause.kind === "postgres" && error.cause.code === POSTGRES_EXCLUSION_VIOLATION
  );
}

function isCodeUniqueViolation(error: unknown): boolean {
  // The driver-adapter error shape for Postgres has no dedicated `constraint` field, only the
  // raw server message/detail — Postgres itself includes the constraint name in both, e.g.
  // `duplicate key value violates unique constraint "bookings_code_key"`.
  return (
    isDriverAdapterError(error) &&
    error.cause.kind === "postgres" &&
    error.cause.code === POSTGRES_UNIQUE_VIOLATION &&
    (error.cause.message.includes("bookings_code_key") || error.cause.detail?.includes("bookings_code_key") === true)
  );
}

/// Creates a booking for any channel. Mirrors src/app/book/actions.ts's original validation
/// (1-hour minimum lead time, therapist auto-assignment for "คนไหนก็ได้") exactly, so the
/// existing web flow's behavior doesn't change — see that file for how it now delegates here.
///
/// Overlap protection is two-layered, same as before: `findAvailableTherapist` is a best-effort
/// pre-check for a good error message, and the database's EXCLUDE constraint
/// (bookings_no_therapist_overlap, see prisma/migrations/20260701061535_init) is the actual
/// guarantee against a race between two concurrent requests for the same therapist/time.
export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const serviceOption = await prisma.serviceOption.findUnique({
    where: { id: input.serviceOptionId, isActive: true },
    include: { service: true },
  });
  if (!serviceOption) throw new BookingValidationError("ไม่พบบริการที่เลือก");

  // Matches the original branch lookup exactly (src/app/book/actions.ts, pre-refactor): no
  // isActive/deletedAt filter here, unlike serviceOption above — not changing that behavior as
  // part of this refactor even though it looks like an oversight, per the "don't touch existing
  // booking logic" rule. Worth revisiting separately if that's actually a bug.
  const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
  if (!branch) throw new BookingValidationError("ไม่พบสาขาที่เลือก");

  const startTime = combineDateAndTime(input.date, input.time);
  const endTime = new Date(startTime.getTime() + serviceOption.durationMinutes * 60_000);

  const oneHourFromNow = new Date(Date.now() + 60 * 60_000);
  if (startTime < oneHourFromNow) {
    throw new BookingValidationError("กรุณาจองล่วงหน้าอย่างน้อย 1 ชั่วโมง");
  }

  const resolvedTherapistId = await findAvailableTherapist(
    input.branchId,
    serviceOption.serviceId,
    startTime,
    endTime,
    input.therapistId
  );
  if (!resolvedTherapistId) {
    throw new SlotTakenError("ขออภัย ไม่มีหมอนวดว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น");
  }

  const customerId = input.customer.type === "user" ? input.customer.userId : undefined;

  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateBookingCode();
    try {
      return await prisma.$transaction(async (tx) => {
        const channelCustomerId =
          input.customer.type === "channel"
            ? (
                await tx.customer.upsert({
                  where: {
                    channel_channelUserId: {
                      channel: input.customer.channel,
                      channelUserId: input.customer.channelUserId,
                    },
                  },
                  update: { name: input.customer.name, phone: input.customer.phone ?? undefined },
                  create: {
                    channel: input.customer.channel,
                    channelUserId: input.customer.channelUserId,
                    name: input.customer.name,
                    phone: input.customer.phone ?? null,
                  },
                })
              ).id
            : undefined;

        const created = await tx.booking.create({
          data: {
            branchId: input.branchId,
            customerId,
            channelCustomerId,
            channel: input.customer.type === "channel" ? input.customer.channel : undefined,
            code,
            serviceOptionId: input.serviceOptionId,
            therapistId: resolvedTherapistId,
            startTime,
            endTime,
            status: "CONFIRMED",
            source: input.source,
            // Matches the original: a self-service booking's createdById is the customer's own
            // user id (only meaningful for the "user" identity type — channel customers have no
            // User row to point at).
            createdById: input.createdById ?? customerId ?? undefined,
            rescheduledFromId: input.supersededBookingId ?? undefined,
          },
        });

        if (input.supersededBookingId) {
          await tx.booking.update({
            where: { id: input.supersededBookingId },
            data: { status: BookingStatus.RESCHEDULED },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: input.createdById ?? customerId ?? null,
            actorRole: "CUSTOMER",
            branchId: input.branchId,
            action: "CREATE",
            entityType: "Booking",
            entityId: created.id,
            afterData: {
              code: created.code,
              serviceOptionId: created.serviceOptionId,
              therapistId: created.therapistId,
              startTime: created.startTime.toISOString(),
              endTime: created.endTime.toISOString(),
              status: created.status,
              channel: created.channel,
            },
          },
        });

        return {
          id: created.id,
          code: created.code,
          startTime: created.startTime,
          endTime: created.endTime,
          therapistId: created.therapistId,
        };
      });
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new SlotTakenError("ขออภัย ช่วงเวลานี้เพิ่งถูกจองไปแล้ว กรุณาเลือกเวลาอื่น");
      }
      if (isCodeUniqueViolation(error) && attempt < MAX_CODE_ATTEMPTS) {
        continue; // extremely unlikely collision — retry with a freshly generated code
      }
      throw error;
    }
  }

  // Unreachable in practice (MAX_CODE_ATTEMPTS collisions in a row is astronomically unlikely),
  // but keeps the function's return type honest without a non-null assertion.
  throw new BookingServiceError("ไม่สามารถสร้างรหัสการจองได้ กรุณาลองใหม่อีกครั้ง");
}

// ─────────────────────────────────────────────────────────────────────────
// /book-now guest bookings (public web, no account) — see PhoneOtpChallenge's doc comment in
// schema.prisma. A guest has no session/account, so "authentication" for managing an existing
// booking is knowing both its public `code` and the phone number that OTP-verified it at creation
// — the two checks below are always done together and return an identical not-found error either
// way, so a wrong guess can't be used to probe which booking codes or phone numbers are real.
// ─────────────────────────────────────────────────────────────────────────

const GUEST_MANAGEABLE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

export type GuestBookingSummary = Awaited<ReturnType<typeof findGuestBooking>>;

/// Looks up a Channel.WEB booking by its public code + the phone that owns it. Returns null if
/// either doesn't match — see the section doc comment above for why that's deliberate.
export async function findGuestBooking(code: string, phone: string) {
  return prisma.booking.findFirst({
    where: { code, channel: Channel.WEB, deletedAt: null, channelCustomer: { channelUserId: phone } },
    include: { branch: true, serviceOption: { include: { service: true } }, therapist: true },
  });
}

async function loadOwnedGuestBooking(bookingId: string, phone: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { channelCustomer: true },
  });
  if (!booking || booking.deletedAt || booking.channel !== Channel.WEB) return null;
  if (!booking.channelCustomer || booking.channelCustomer.channelUserId !== phone) return null;
  return booking;
}

export type GuestActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; notFound?: boolean };

export async function cancelGuestBooking(bookingId: string, phone: string): Promise<GuestActionResult> {
  const booking = await loadOwnedGuestBooking(bookingId, phone);
  if (!booking) return { success: false, error: "ไม่พบการจองนี้", notFound: true };
  if (!GUEST_MANAGEABLE_STATUSES.includes(booking.status)) {
    return { success: false, error: "ไม่สามารถยกเลิกการจองนี้ได้" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancelReason: "ลูกค้ายกเลิกเอง (จองผ่านเว็บ)" },
    });

    await tx.auditLog.create({
      data: {
        branchId: booking.branchId,
        action: "CANCEL_BOOKING",
        entityType: "Booking",
        entityId: bookingId,
        beforeData: { status: booking.status },
        afterData: { status: BookingStatus.CANCELLED },
        metadata: { channelCustomerId: booking.channelCustomerId, channel: Channel.WEB },
      },
    });
  });

  return { success: true, data: undefined };
}

/// Mirrors src/app/account/actions.ts's rescheduleBooking (currently unreachable — the /account
/// portal is retired, see src/middleware.ts) but authorizes by phone match instead of a session,
/// and delegates the actual create+supersede to createBooking's supersededBookingId param instead
/// of hand-rolling a second transaction here.
export async function rescheduleGuestBooking(
  bookingId: string,
  phone: string,
  date: string,
  time: string
): Promise<GuestActionResult<CreatedBooking>> {
  const booking = await loadOwnedGuestBooking(bookingId, phone);
  if (!booking) return { success: false, error: "ไม่พบการจองนี้", notFound: true };
  if (!GUEST_MANAGEABLE_STATUSES.includes(booking.status)) {
    return { success: false, error: "ไม่สามารถเลื่อนนัดการจองนี้ได้" };
  }

  try {
    const created = await createBooking({
      branchId: booking.branchId,
      serviceOptionId: booking.serviceOptionId,
      // Keep the same therapist as the original booking (or the same "any therapist" preference,
      // if therapistId was already null) — if they're not free at the new time, the customer is
      // asked to pick another time rather than silently swapping to a different person.
      therapistId: booking.therapistId,
      date,
      time,
      source: booking.source,
      customer: {
        type: "channel",
        channel: Channel.WEB,
        channelUserId: phone,
        name: booking.channelCustomer!.name,
        phone,
      },
      supersededBookingId: booking.id,
    });
    return { success: true, data: created };
  } catch (error) {
    if (error instanceof SlotTakenError || error instanceof BookingValidationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

export { Channel };
