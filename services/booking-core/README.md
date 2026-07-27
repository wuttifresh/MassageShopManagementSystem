# booking-core

Phase 1 of the Go/Fiber migration plan: a standalone booking core — slot availability, create
booking, cancel booking — that reads and writes the **same Postgres database and schema** the
existing Next.js/Prisma app uses (see `prisma/schema.prisma` at the repo root). It does not run
its own migrations or own a separate schema.

**Phase 2 update**: `/book-now` (public web booking, no login) now calls this service for
availability + create, via `src/lib/booking-core-client.ts` proxied through
`/api/book-now/availability` and `/api/book-now/bookings` — `BOOKING_CORE_URL` in `.env.example`.
Cancel/reschedule/lookup for `/book-now` still go through the TypeScript `booking-service.ts`
directly (unchanged) — only availability + create moved.

**Phase 3 update**: the LINE webhook (`src/app/api/line/webhook`) replies with a link to
`/book-now` rather than calling this service directly yet — see
`src/lib/channel-booking-adapter.ts` for the shared adapter.

**Phase 4 update**: POS (`/dashboard/pos`) sells against the Prisma-side `Queue`/`Booking` records
this service creates; it doesn't call this service directly.

**Phase 5 update**: `therapist_time_blocks` (a therapist's blocked sub-ranges on one date — lunch
break, a personal appointment, etc.) are now treated exactly like a booking when computing free
slots, in both this service (`getBusyRanges` in `internal/booking/repository.go`, used by
`GetAvailableSlots`/`CreateBooking`) and the TypeScript app (`getBusyRanges` in
`src/lib/availability.ts`) — the two implementations are kept in lockstep by design, same as every
other overlap rule here. Managed from `/dashboard/therapists/[id]/schedule` (add/list/delete) and
visualized against a real day's bookings in `/dashboard/therapists/[id]/calendar`, which fetches
bookings straight from Prisma (for customer/service detail this service's anonymous availability
endpoint can't provide) and cross-checks the resulting free-slot list against `GET
/v1/availability` on this service — proving the calendar view and this Phase 1 engine actually
agree, not just that they're supposed to.

## Endpoints

- `GET /v1/availability?branchId=&serviceOptionId=&date=&therapistId=` — `therapistId` omitted =
  union of every eligible therapist's free slots ("คนไหนก็ได้").
- `POST /v1/bookings` — `{branchId, serviceOptionId, therapistId, date, time, source, channel,
  channelUserId, guestName, guestPhone}`. `therapistId` empty = pick any available therapist.
  `channel`+`channelUserId` set together upsert a `customers` row (channel, channel_user_id) and
  link it via the booking's `channel_customer_id` — e.g. `/book-now` sends `channel: "WEB"`,
  `channelUserId: <normalized phone>` — matching how LINE customers already work in
  `src/lib/booking-service.ts`, so Phase 3's channel adapters can reuse this same endpoint instead
  of a separate one. Both empty = the legacy `guest_name`/`guest_phone` path instead. Returns 409
  if the slot is taken, 400 on validation errors.
- `POST /v1/bookings/:id/cancel` — `{reason}`. 409 if the booking isn't in a cancellable state
  (PENDING/CONFIRMED), 404 if it doesn't exist.

`GET /healthz` for liveness checks.

## Double-booking protection

Two layers, same design as the existing TypeScript booking service
(`src/lib/booking-service.ts`):

1. A Postgres advisory lock (`pg_advisory_xact_lock(hashtext(therapist_id))`, scoped to the
   transaction) serializes concurrent booking attempts for the same therapist, so the
   availability check and the insert are effectively atomic per therapist.
2. The `bookings_no_therapist_overlap` `EXCLUDE` constraint
   (`prisma/migrations/20260701061535_init`) is the actual database-level guarantee — verified by
   temporarily removing the advisory lock and re-running
   `TestCreateBooking_DoubleBookingRace`: it still passes, because the constraint alone rejects
   every conflicting insert. The lock's job is avoiding the abort/retry churn under real
   contention, not being the only thing standing between two customers and the same time slot.

## Running locally

```
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
go run ./cmd/server        # listens on :8081 by default, override with PORT
```

## Deploying

This is a persistent Fiber server, not a serverless function — it doesn't fit Vercel (where the
rest of the app runs). `Dockerfile`/`fly.toml` in this directory deploy it to Fly.io; see
`DEPLOYMENT.md` at the repo root, section "5. Deploy Go booking-core service (Phase 1) ไป Fly.io",
for the full walkthrough (`fly launch --no-deploy` → `fly secrets set DATABASE_URL=...` →
`fly deploy`, then point the Next.js app's `BOOKING_CORE_URL` at the resulting `https://*.fly.dev`
URL).

## Testing

```
export TEST_DATABASE_URL="postgresql://user:pass@host:5432/dbname"
go test ./... -race
```

Tests are skipped (not failed) if `TEST_DATABASE_URL` is unset. They need a real Postgres with
the app's schema already migrated (`npx prisma migrate deploy` from the repo root) — each test
creates its own branch/service/therapist fixtures and cleans them up afterward, so it's safe to
point at a shared dev database.

`TestCreateBooking_DoubleBookingRace` fires 20 concurrent `CreateBooking` calls at the exact same
therapist/slot and asserts exactly one succeeds — the test this phase was written to prove.

`TestGetAvailableSlots_ExcludesTimeBlock` (Phase 5) proves a `therapist_time_blocks` row narrows
`GetAvailableSlots` and gets rejected by `CreateBooking` with `ErrSlotTaken` exactly like an
existing booking would.
