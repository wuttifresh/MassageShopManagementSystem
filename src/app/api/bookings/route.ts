import { NextResponse } from "next/server";
import { BookingSource, Role } from "@/generated/prisma/client";
import { getCurrentSession } from "@/lib/session";
import { verifyLineIdToken } from "@/lib/line-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  BookingValidationError,
  Channel,
  SlotTakenError,
  createBooking,
  getAvailableSlots,
  getBranches,
  getServices,
  type BookingCustomerIdentity,
} from "@/lib/booking-service";

// Verifies identity against LINE's server and does in-memory rate-limit bookkeeping — neither is
// crypto, but this keeps the trust boundary explicit and safe from ever landing on edge runtime
// (coding rule #7; the in-memory rate limiter also just wouldn't work correctly on edge, which
// runs each request in a fresh isolate with no shared module state).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CREATE_BOOKING_LIMIT = 5;
const CREATE_BOOKING_WINDOW_MS = 5 * 60_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const meta = searchParams.get("meta");

  if (meta === "branches") {
    return NextResponse.json({ branches: await getBranches() });
  }
  if (meta === "services") {
    return NextResponse.json({ services: await getServices() });
  }

  const branchId = searchParams.get("branchId");
  const serviceOptionId = searchParams.get("serviceOptionId");
  const dateParam = searchParams.get("date");
  const therapistId = searchParams.get("therapistId");

  if (!branchId || !serviceOptionId || !dateParam) {
    return NextResponse.json({ error: "ต้องระบุ branchId, serviceOptionId และ date" }, { status: 400 });
  }
  if (!DATE_PATTERN.test(dateParam)) {
    return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" }, { status: 400 });
  }

  const date = new Date(dateParam);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const slots = await getAvailableSlots({
      branchId,
      serviceOptionId,
      date,
      therapistId: therapistId || undefined,
    });
    return NextResponse.json({
      slots: slots.map((s) => `${String(s.getUTCHours()).padStart(2, "0")}:${String(s.getUTCMinutes()).padStart(2, "0")}`),
    });
  } catch (error) {
    if (error instanceof BookingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

type CreateBookingBody = {
  branchId?: unknown;
  serviceOptionId?: unknown;
  therapistId?: unknown;
  date?: unknown;
  time?: unknown;
  /// "LINE" is the only recognized value right now — presence of this exact string is what
  /// triggers LINE ID-token verification below. Anything else falls back to the existing
  /// NextAuth session (the "web" case), matching how src/app/book/actions.ts already works.
  channel?: unknown;
  /// Only used to prefill a *new* Customer row's display name/phone — never used as identity.
  name?: unknown;
  phone?: unknown;
};

export async function POST(request: Request) {
  let body: CreateBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)" }, { status: 400 });
  }

  const missing: string[] = [];
  if (!isNonEmptyString(body.branchId)) missing.push("branchId");
  if (!isNonEmptyString(body.serviceOptionId)) missing.push("serviceOptionId");
  if (!isNonEmptyString(body.date)) missing.push("date");
  if (!isNonEmptyString(body.time)) missing.push("time");
  if (missing.length > 0) {
    return NextResponse.json({ error: `กรุณาระบุข้อมูลให้ครบ: ${missing.join(", ")}` }, { status: 400 });
  }
  if (!DATE_PATTERN.test(body.date as string)) {
    return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" }, { status: 400 });
  }
  if (!TIME_PATTERN.test(body.time as string)) {
    return NextResponse.json({ error: "รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:mm)" }, { status: 400 });
  }
  if (body.therapistId !== undefined && body.therapistId !== null && !isNonEmptyString(body.therapistId)) {
    return NextResponse.json({ error: "therapistId ไม่ถูกต้อง" }, { status: 400 });
  }

  // --- Resolve & verify identity -------------------------------------------------------
  // Coding rule #5: never trust identity claimed by the client. `channel: "LINE"` requires a
  // LINE ID token, verified against LINE's own server, and the verified `sub` (not anything the
  // client sent) becomes the channelUserId. Every other case falls back to the existing NextAuth
  // session cookie — there is no path where a client-supplied user/channel id is taken as-is.
  let customer: BookingCustomerIdentity;
  let identityKey: string;

  if (body.channel === "LINE") {
    const authHeader = request.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!idToken) {
      return NextResponse.json({ error: "ต้องแนบ LINE ID token ใน Authorization header" }, { status: 401 });
    }

    const verified = await verifyLineIdToken(idToken);
    if (!verified) {
      return NextResponse.json({ error: "ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่อีกครั้ง" }, { status: 401 });
    }

    customer = {
      type: "channel",
      channel: Channel.LINE,
      channelUserId: verified.sub,
      name: isNonEmptyString(body.name) ? body.name : (verified.name ?? "ลูกค้า LINE"),
      phone: isNonEmptyString(body.phone) ? body.phone : null,
    };
    identityKey = `line:${verified.sub}`;
  } else {
    const session = await getCurrentSession();
    if (!session?.user || session.user.role !== Role.CUSTOMER) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้าก่อนทำการจอง" }, { status: 401 });
    }
    customer = { type: "user", userId: session.user.id };
    identityKey = `user:${session.user.id}`;
  }

  const rateLimit = checkRateLimit(`create-booking:${identityKey}`, CREATE_BOOKING_LIMIT, CREATE_BOOKING_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "คุณทำรายการจองบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }

  try {
    const booking = await createBooking({
      branchId: body.branchId as string,
      serviceOptionId: body.serviceOptionId as string,
      therapistId: isNonEmptyString(body.therapistId) ? body.therapistId : null,
      date: body.date as string,
      time: body.time as string,
      source: BookingSource.ONLINE,
      customer,
    });

    return NextResponse.json(
      { bookingId: booking.id, code: booking.code, startTime: booking.startTime, endTime: booking.endTime },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof BookingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
