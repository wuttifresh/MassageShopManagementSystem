package booking

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Executor is satisfied by both *pgxpool.Pool (read-only queries, e.g. GET availability) and
// pgx.Tx (everything inside CreateBooking's transaction, so the advisory lock and every read
// happen on the same underlying connection) — a plain structural interface rather than
// depending on pgx.Tx's full type so callers can pass either.
type Executor interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func getServiceOption(ctx context.Context, ex Executor, id string) (ServiceOption, error) {
	var so ServiceOption
	err := ex.QueryRow(ctx,
		`SELECT id, service_id, duration_minutes, is_active FROM service_options WHERE id = $1`,
		id,
	).Scan(&so.ID, &so.ServiceID, &so.DurationMinutes, &so.IsActive)
	return so, err
}

func branchExists(ctx context.Context, ex Executor, id string) (bool, error) {
	var exists bool
	err := ex.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM branches WHERE id = $1)`, id).Scan(&exists)
	return exists, err
}

// getEligibleTherapists mirrors src/lib/availability.ts's getEligibleTherapists: therapists at
// the branch who list this service as a specialty; if none do yet, fall back to every active
// therapist at the branch instead of an empty list (a common gap right after a branch/service is
// set up — better to offer every therapist than none).
func getEligibleTherapists(ctx context.Context, ex Executor, branchID, serviceID string) ([]Therapist, error) {
	bySpecialty, err := queryTherapists(ctx, ex, `
		SELECT t.id, t.nickname FROM therapists t
		JOIN therapist_services ts ON ts.therapist_id = t.id
		WHERE t.branch_id = $1 AND t.status = 'ACTIVE' AND t.deleted_at IS NULL AND ts.service_id = $2
		ORDER BY t.nickname ASC`, branchID, serviceID)
	if err != nil {
		return nil, err
	}
	if len(bySpecialty) > 0 {
		return bySpecialty, nil
	}

	return queryTherapists(ctx, ex, `
		SELECT id, nickname FROM therapists
		WHERE branch_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
		ORDER BY nickname ASC`, branchID)
}

func queryTherapists(ctx context.Context, ex Executor, sql string, args ...any) ([]Therapist, error) {
	rows, err := ex.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Therapist
	for rows.Next() {
		var t Therapist
		if err := rows.Scan(&t.ID, &t.Nickname); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// getSpecificTherapist validates a customer-preferred therapistId belongs to the branch and is
// bookable, mirroring the `preferredTherapistId` branch of findAvailableTherapist in
// src/lib/availability.ts.
func getSpecificTherapist(ctx context.Context, ex Executor, branchID, therapistID string) (*Therapist, error) {
	var t Therapist
	err := ex.QueryRow(ctx, `
		SELECT id, nickname FROM therapists
		WHERE id = $1 AND branch_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
		therapistID, branchID,
	).Scan(&t.ID, &t.Nickname)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// getWorkingWindow returns the therapist's WORKING shift on `date`, or nil if they're off /
// unscheduled that day — mirrors getWorkingWindow in src/lib/availability.ts.
func getWorkingWindow(ctx context.Context, ex Executor, therapistID string, date time.Time) (*TimeRange, error) {
	var status string
	var startTime, endTime *string
	err := ex.QueryRow(ctx, `
		SELECT status, start_time, end_time FROM therapist_schedules
		WHERE therapist_id = $1 AND date = $2`,
		therapistID, date,
	).Scan(&status, &startTime, &endTime)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if status != "WORKING" || startTime == nil || endTime == nil {
		return nil, nil
	}

	start, err := combineDateAndTime(date, *startTime)
	if err != nil {
		return nil, err
	}
	end, err := combineDateAndTime(date, *endTime)
	if err != nil {
		return nil, err
	}
	return &TimeRange{Start: start, End: end}, nil
}

// getBookedRanges returns every active (PENDING/CONFIRMED, not soft-deleted) booking for this
// therapist that could possibly overlap `date` — mirrors getBookedRanges in
// src/lib/availability.ts. The caller still does the precise overlap check in Go.
func getBookedRanges(ctx context.Context, ex Executor, therapistID string, date time.Time) ([]TimeRange, error) {
	dayStart := date
	dayEnd := date.Add(24 * time.Hour)

	rows, err := ex.Query(ctx, `
		SELECT start_time, end_time FROM bookings
		WHERE therapist_id = $1 AND deleted_at IS NULL AND status IN ('PENDING', 'CONFIRMED')
		  AND start_time < $2 AND end_time > $3`,
		therapistID, dayEnd, dayStart,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TimeRange
	for rows.Next() {
		var r TimeRange
		if err := rows.Scan(&r.Start, &r.End); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// lockTherapistForBooking serializes every concurrent booking attempt for this therapist within
// the current transaction via a Postgres advisory lock keyed by therapist id — this is the "row
// lock ตอน confirm" the Phase 1 brief asks for. It's released automatically when the transaction
// commits or rolls back (pg_advisory_xact_lock, not pg_advisory_lock). Combined with the
// bookings_no_therapist_overlap EXCLUDE constraint (prisma/migrations/20260701061535_init) as the
// actual last line of defense, this gives the same two-layer protection every other booking
// channel already has. Without this lock the constraint alone still prevents any double-booking
// (verified by temporarily removing this call and re-running TestCreateBooking_DoubleBookingRace —
// still passes), but every losing transaction fails as a Postgres exclusion-violation abort
// instead of a clean "not free, try the next candidate" — this lock trades a bit of serialization
// for avoiding that abort/retry churn under real contention.
func lockTherapistForBooking(ctx context.Context, tx pgx.Tx, therapistID string) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, therapistID)
	return err
}

type insertBookingParams struct {
	BranchID        string
	ServiceOptionID string
	TherapistID     string
	GuestName       string
	GuestPhone      *string
	Code            string
	StartTime       time.Time
	EndTime         time.Time
	Source          string
}

func insertBooking(ctx context.Context, tx pgx.Tx, p insertBookingParams) (Booking, error) {
	var b Booking
	b.TherapistID = &p.TherapistID
	err := tx.QueryRow(ctx, `
		INSERT INTO bookings
			(id, branch_id, service_option_id, therapist_id, guest_name, guest_phone, code,
			 start_time, end_time, status, source, created_at, updated_at)
		VALUES
			(gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 'CONFIRMED', $9::booking_source, now(), now())
		RETURNING id, code, start_time, end_time, status`,
		p.BranchID, p.ServiceOptionID, p.TherapistID, p.GuestName, p.GuestPhone, p.Code,
		p.StartTime, p.EndTime, p.Source,
	).Scan(&b.ID, &b.Code, &b.StartTime, &b.EndTime, &b.Status)
	if err != nil {
		return Booking{}, err
	}
	b.BranchID = p.BranchID
	b.ServiceOptionID = p.ServiceOptionID
	b.GuestName = p.GuestName
	b.GuestPhone = p.GuestPhone
	b.Source = p.Source
	return b, nil
}

func insertAuditLog(ctx context.Context, tx pgx.Tx, branchID, action, entityType, entityID string, afterData []byte) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, branch_id, action, entity_type, entity_id, after_data, created_at)
		VALUES (gen_random_uuid()::text, $1, $2::audit_action, $3, $4, $5::jsonb, now())`,
		branchID, action, entityType, entityID, afterData,
	)
	return err
}

func getBookingByID(ctx context.Context, ex Executor, id string) (Booking, error) {
	var b Booking
	var therapistID *string
	err := ex.QueryRow(ctx, `
		SELECT id, branch_id, service_option_id, therapist_id, code, start_time, end_time, status, source
		FROM bookings WHERE id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&b.ID, &b.BranchID, &b.ServiceOptionID, &therapistID, &b.Code, &b.StartTime, &b.EndTime, &b.Status, &b.Source)
	if err == pgx.ErrNoRows {
		return Booking{}, ErrNotFound
	}
	if err != nil {
		return Booking{}, err
	}
	b.TherapistID = therapistID
	return b, nil
}

func updateBookingStatus(ctx context.Context, tx pgx.Tx, id string, status Status, cancelReason string) error {
	_, err := tx.Exec(ctx, `
		UPDATE bookings
		SET status = $2::booking_status, cancelled_at = now(), cancel_reason = $3, updated_at = now()
		WHERE id = $1`,
		id, status, cancelReason,
	)
	return err
}

func combineDateAndTime(date time.Time, hhmm string) (time.Time, error) {
	t, err := time.Parse("15:04", hhmm)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(date.Year(), date.Month(), date.Day(), t.Hour(), t.Minute(), 0, 0, time.UTC), nil
}
