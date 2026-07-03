// Test-only stand-in for `@/generated/prisma/client`, which doesn't exist until `prisma generate`
// has run against a real database connection (this repo's dev sandbox has no network access to
// fetch Prisma's engine binaries — see multi-channel-booking-prompt.md checkpoint notes). Only
// re-implements the enum *values* that lib/availability.ts and lib/booking-service.ts import at
// runtime (as opposed to type-only imports, which are erased and need no runtime stand-in) —
// matching Prisma's actual generated shape: a plain object keyed by each variant's own name.
// Wired in via vitest.config.ts's resolve.alias, not a per-file vi.mock, so every test gets it
// automatically and no test has to know this limitation exists.

export const ScheduleStatus = { WORKING: "WORKING", DAY_OFF: "DAY_OFF", LEAVE: "LEAVE" } as const;

export const BookingStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
  COMPLETED: "COMPLETED",
  RESCHEDULED: "RESCHEDULED",
} as const;

export const TherapistStatus = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE", ON_LEAVE: "ON_LEAVE" } as const;

export const Channel = { LINE: "LINE", WHATSAPP: "WHATSAPP" } as const;

export const BookingSource = { ONLINE: "ONLINE", WALK_IN: "WALK_IN", PHONE: "PHONE", ADMIN: "ADMIN" } as const;

export const Role = { OWNER: "OWNER", STAFF: "STAFF", THERAPIST: "THERAPIST", CUSTOMER: "CUSTOMER" } as const;

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  VOID: "VOID",
  REFUND: "REFUND",
  CHECK_IN: "CHECK_IN",
  CHECK_OUT: "CHECK_OUT",
  ASSIGN_THERAPIST: "ASSIGN_THERAPIST",
  CANCEL_BOOKING: "CANCEL_BOOKING",
  RESCHEDULE_BOOKING: "RESCHEDULE_BOOKING",
  REDEEM_PACKAGE: "REDEEM_PACKAGE",
  ADJUST_POINTS: "ADJUST_POINTS",
  SEND_NOTIFICATION: "SEND_NOTIFICATION",
} as const;
