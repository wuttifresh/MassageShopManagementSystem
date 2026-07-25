# booking-core

Phase 1 of the Go/Fiber migration plan: a standalone booking core — slot availability, create
booking, cancel booking — that reads and writes the **same Postgres database and schema** the
existing Next.js/Prisma app uses (see `prisma/schema.prisma` at the repo root). It does not run
its own migrations or own a separate schema.

Not yet wired up to anything: nothing in the Next.js app or any channel adapter calls this service
yet. Phase 2/3 will decide how the public booking page and WhatsApp/LINE adapters reach it
(direct HTTP call from a Next.js route handler, or something else) — an open question, not
resolved by this phase.

## Endpoints

- `GET /v1/availability?branchId=&serviceOptionId=&date=&therapistId=` — `therapistId` omitted =
  union of every eligible therapist's free slots ("คนไหนก็ได้").
- `POST /v1/bookings` — `{branchId, serviceOptionId, therapistId, date, time, guestName, guestPhone,
  source}`. `therapistId` empty = pick any available therapist. Returns 409 if the slot is taken,
  400 on validation errors.
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
