# booking-core

Phase 1 of the Go/Fiber migration plan: a standalone booking core — slot availability, create
booking, cancel booking — that reads and writes the **same Postgres database and schema** the
existing Next.js/Prisma app uses (see `prisma/schema.prisma` at the repo root). It does not run
its own migrations or own a separate schema.

**Phase 2 update**: `/book-now` (public web booking, no login) now calls this service for
availability + create, via `src/lib/booking-core-client.ts` proxied through
`/api/book-now/availability` and `/api/book-now/bookings` — `BOOKING_CORE_URL` in `.env.example`.
Cancel/reschedule/lookup for `/book-now` still go through the TypeScript `booking-service.ts`
directly (unchanged) — only availability + create moved. LINE/WhatsApp channel adapters (Phase 3)
are still not wired up.

## Endpoints

- `GET /v1/availability?branchId=&serviceOptionId=&date=&therapistId=` — `therapistId` omitted =
  union of every eligible therapist's free slots ("คนไหนก็ได้").
- `POST /v1/bookings` — `{branchId, serviceOptionId, therapistId, date, time, source, channel,
  channelUserId, guestName, guestPhone}`. `therapistId` empty = pick any available therapist.
  `channel`+`channelUserId` set together upsert a `customers` row (channel, channel_user_id) and
  link it via the booking's `channel_customer_id` — e.g. `/book-now` sends `channel: "WEB"`,
  `channelUserId: <OTP-verified phone>` — matching how LINE/WhatsApp customers already work in
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
