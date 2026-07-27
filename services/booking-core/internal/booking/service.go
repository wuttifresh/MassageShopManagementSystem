// Package booking is the channel-agnostic booking core (Phase 1 of the migration plan) —
// slot availability, create, and cancel, backed by the same Postgres database and schema the
// existing Next.js/Prisma app uses. Nothing here talks to LINE/HTTP directly; Phase 3's
// channel adapters call Create/Cancel/GetAvailableSlots, they don't reimplement booking logic.
package booking

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	slotStepMinutes    = 30
	minLeadTimeMinutes = 60
	maxSlots           = 50
	maxCodeAttempts    = 5
	bookingCodeAlpha   = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" // no 0/O/1/I — avoids ambiguity

	postgresExclusionViolation = "23P01"
	postgresUniqueViolation    = "23505"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func rangesOverlap(aStart, aEnd, bStart, bEnd time.Time) bool {
	return aStart.Before(bEnd) && bStart.Before(aEnd)
}

func generateCandidateSlots(window TimeRange, durationMinutes int, booked []TimeRange, now time.Time) []time.Time {
	earliestStart := now.Add(minLeadTimeMinutes * time.Minute)
	duration := time.Duration(durationMinutes) * time.Minute

	var slots []time.Time
	for cursor := window.Start; !cursor.Add(duration).After(window.End); cursor = cursor.Add(slotStepMinutes * time.Minute) {
		slotEnd := cursor.Add(duration)
		if cursor.Before(earliestStart) {
			continue
		}
		free := true
		for _, r := range booked {
			if rangesOverlap(cursor, slotEnd, r.Start, r.End) {
				free = false
				break
			}
		}
		if free {
			slots = append(slots, cursor)
		}
	}
	return slots
}

// GetTherapistSlots returns every free start time for one specific therapist on `date`.
func (s *Service) GetTherapistSlots(ctx context.Context, therapistID string, date time.Time, durationMinutes int) ([]time.Time, error) {
	window, err := getWorkingWindow(ctx, s.pool, therapistID, date)
	if err != nil {
		return nil, err
	}
	if window == nil {
		return nil, nil
	}
	busy, err := getBusyRanges(ctx, s.pool, therapistID, date)
	if err != nil {
		return nil, err
	}
	return generateCandidateSlots(*window, durationMinutes, busy, time.Now().UTC()), nil
}

// GetAvailableSlots is the "คนไหนก็ได้" (any therapist) union used by the public availability
// endpoint, or a single therapist's slots when therapistID is non-empty — mirrors
// getAvailableSlots in src/lib/booking-service.ts.
func (s *Service) GetAvailableSlots(ctx context.Context, branchID, serviceOptionID, therapistID string, date time.Time) ([]time.Time, error) {
	so, err := getServiceOption(ctx, s.pool, serviceOptionID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("%w: unknown service option", ErrValidation)
		}
		return nil, err
	}
	if !so.IsActive {
		return nil, fmt.Errorf("%w: unknown service option", ErrValidation)
	}

	var slots []time.Time
	if therapistID != "" {
		slots, err = s.GetTherapistSlots(ctx, therapistID, date, so.DurationMinutes)
	} else {
		slots, err = s.getAnyTherapistSlots(ctx, branchID, so.ServiceID, date, so.DurationMinutes)
	}
	if err != nil {
		return nil, err
	}
	if len(slots) > maxSlots {
		slots = slots[:maxSlots]
	}
	return slots, nil
}

// getAnyTherapistSlots unions every eligible therapist's free slots. Fetches each therapist's
// working window and busy ranges in two batched round trips (getWorkingWindowsBulk,
// getBusyRangesBulk) rather than looping GetTherapistSlots once per therapist — the loop used to
// cost 3 sequential DB round trips per eligible therapist, which is what made this endpoint slow
// on any branch with more than a couple of staff.
func (s *Service) getAnyTherapistSlots(ctx context.Context, branchID, serviceID string, date time.Time, durationMinutes int) ([]time.Time, error) {
	therapists, err := getEligibleTherapists(ctx, s.pool, branchID, serviceID)
	if err != nil {
		return nil, err
	}
	if len(therapists) == 0 {
		return nil, nil
	}

	ids := make([]string, len(therapists))
	for i, t := range therapists {
		ids[i] = t.ID
	}

	windows, err := getWorkingWindowsBulk(ctx, s.pool, ids, date)
	if err != nil {
		return nil, err
	}
	busy, err := getBusyRangesBulk(ctx, s.pool, ids, date)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	unique := map[int64]time.Time{}
	for _, id := range ids {
		window, ok := windows[id]
		if !ok {
			continue
		}
		for _, slot := range generateCandidateSlots(window, durationMinutes, busy[id], now) {
			unique[slot.UnixNano()] = slot
		}
	}

	out := make([]time.Time, 0, len(unique))
	for _, v := range unique {
		out = append(out, v)
	}
	sortTimes(out)
	return out, nil
}

func sortTimes(t []time.Time) {
	for i := 1; i < len(t); i++ {
		for j := i; j > 0 && t[j].Before(t[j-1]); j-- {
			t[j], t[j-1] = t[j-1], t[j]
		}
	}
}

func generateBookingCode() (string, error) {
	suffix := make([]byte, 4)
	for i := range suffix {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(bookingCodeAlpha))))
		if err != nil {
			return "", err
		}
		suffix[i] = bookingCodeAlpha[n.Int64()]
	}
	return "BK-" + string(suffix), nil
}

type CreateInput struct {
	BranchID        string
	ServiceOptionID string
	// Empty string = "คนไหนก็ได้" (any available therapist).
	TherapistID string
	Date        string // YYYY-MM-DD
	Time        string // HH:mm
	Source      string
	Customer    CustomerIdentity
}

// CreateBooking validates the request, resolves a concrete free therapist under a Postgres
// advisory lock (see lockTherapistForBooking), and inserts the booking — all inside one
// transaction, retried on a booking-code collision. See the package doc comment for how this
// relates to the EXCLUDE constraint.
func (s *Service) CreateBooking(ctx context.Context, in CreateInput) (Booking, error) {
	hasChannel := in.Customer.Channel != ""
	hasChannelUserID := in.Customer.ChannelUserID != ""
	if hasChannel != hasChannelUserID {
		// Either both Channel and ChannelUserID are set (channel-linked customer) or neither is
		// (legacy guest_name/guest_phone path) — a half-filled identity is a caller bug, not
		// something to silently paper over.
		return Booking{}, fmt.Errorf("%w: customer.channel and customer.channelUserID must be set together", ErrValidation)
	}
	if in.Customer.Channel == "" && in.Customer.Name == "" {
		return Booking{}, fmt.Errorf("%w: customer name is required", ErrValidation)
	}

	date, err := time.ParseInLocation("2006-01-02", in.Date, time.UTC)
	if err != nil {
		return Booking{}, fmt.Errorf("%w: invalid date", ErrValidation)
	}
	startTime, err := combineDateAndTime(date, in.Time)
	if err != nil {
		return Booking{}, fmt.Errorf("%w: invalid time", ErrValidation)
	}

	so, err := getServiceOption(ctx, s.pool, in.ServiceOptionID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Booking{}, fmt.Errorf("%w: unknown service option", ErrValidation)
		}
		return Booking{}, err
	}
	if !so.IsActive {
		return Booking{}, fmt.Errorf("%w: unknown service option", ErrValidation)
	}

	exists, err := branchExists(ctx, s.pool, in.BranchID)
	if err != nil {
		return Booking{}, err
	}
	if !exists {
		return Booking{}, fmt.Errorf("%w: unknown branch", ErrValidation)
	}

	endTime := startTime.Add(time.Duration(so.DurationMinutes) * time.Minute)
	if startTime.Before(time.Now().UTC().Add(minLeadTimeMinutes * time.Minute)) {
		return Booking{}, fmt.Errorf("%w: must book at least %d minutes in advance", ErrValidation, minLeadTimeMinutes)
	}

	for attempt := 0; attempt < maxCodeAttempts; attempt++ {
		booking, err := s.attemptCreate(ctx, in, so, startTime, endTime)
		if err == nil {
			return booking, nil
		}
		if errors.Is(err, errCodeCollision) {
			continue // extremely unlikely — retry with a freshly generated code
		}
		return Booking{}, err
	}

	return Booking{}, fmt.Errorf("could not allocate a unique booking code after %d attempts", maxCodeAttempts)
}

var errCodeCollision = errors.New("booking code collision")

func (s *Service) attemptCreate(ctx context.Context, in CreateInput, so ServiceOption, startTime, endTime time.Time) (Booking, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Booking{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	candidates, err := resolveCandidates(ctx, tx, in.BranchID, so.ServiceID, in.TherapistID)
	if err != nil {
		return Booking{}, err
	}

	resolvedTherapistID := ""
	for _, candidate := range candidates {
		// The advisory lock (scoped to this transaction) serializes every concurrent attempt to
		// book *this* therapist — a second transaction targeting the same therapist blocks here
		// until this one commits or rolls back, so the overlap check below can't race.
		if err := lockTherapistForBooking(ctx, tx, candidate.ID); err != nil {
			return Booking{}, err
		}

		window, err := getWorkingWindow(ctx, tx, candidate.ID, startTime.Truncate(24*time.Hour))
		if err != nil {
			return Booking{}, err
		}
		if window == nil || startTime.Before(window.Start) || endTime.After(window.End) {
			continue
		}

		busy, err := getBusyRanges(ctx, tx, candidate.ID, startTime.Truncate(24*time.Hour))
		if err != nil {
			return Booking{}, err
		}
		free := true
		for _, r := range busy {
			if rangesOverlap(startTime, endTime, r.Start, r.End) {
				free = false
				break
			}
		}
		if free {
			resolvedTherapistID = candidate.ID
			break
		}
	}

	if resolvedTherapistID == "" {
		return Booking{}, ErrSlotTaken
	}

	code, err := generateBookingCode()
	if err != nil {
		return Booking{}, err
	}

	source := in.Source
	if source == "" {
		source = "ONLINE"
	}

	params := insertBookingParams{
		BranchID:        in.BranchID,
		ServiceOptionID: in.ServiceOptionID,
		TherapistID:     resolvedTherapistID,
		Code:            code,
		StartTime:       startTime,
		EndTime:         endTime,
		Source:          source,
	}

	if in.Customer.Channel != "" {
		customerID, err := upsertChannelCustomer(ctx, tx, in.Customer.Channel, in.Customer.ChannelUserID, in.Customer.Name, in.Customer.Phone)
		if err != nil {
			return Booking{}, err
		}
		params.Channel = &in.Customer.Channel
		params.ChannelCustomerID = &customerID
	} else {
		params.GuestName = &in.Customer.Name
		params.GuestPhone = in.Customer.Phone
	}

	created, err := insertBooking(ctx, tx, params)
	if err != nil {
		if isExclusionViolation(err) {
			return Booking{}, ErrSlotTaken
		}
		if isUniqueViolation(err, "bookings_code_key") {
			return Booking{}, errCodeCollision
		}
		return Booking{}, err
	}

	afterData := fmt.Sprintf(
		`{"code":"%s","serviceOptionId":"%s","therapistId":"%s","startTime":"%s","endTime":"%s","status":"CONFIRMED"}`,
		created.Code, in.ServiceOptionID, resolvedTherapistID, startTime.Format(time.RFC3339), endTime.Format(time.RFC3339),
	)
	if err := insertAuditLog(ctx, tx, in.BranchID, "CREATE", "Booking", created.ID, []byte(afterData)); err != nil {
		return Booking{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Booking{}, err
	}

	created.BranchID = in.BranchID
	created.ServiceOptionID = in.ServiceOptionID
	created.Source = source
	return created, nil
}

// resolveCandidates returns the ordered list of therapists to try: just the customer's preferred
// pick if they made one (ErrSlotTaken if that therapist isn't valid), otherwise every eligible
// therapist at the branch in nickname order — mirrors findAvailableTherapist in
// src/lib/availability.ts.
func resolveCandidates(ctx context.Context, tx pgx.Tx, branchID, serviceID, preferredTherapistID string) ([]Therapist, error) {
	if preferredTherapistID != "" {
		t, err := getSpecificTherapist(ctx, tx, branchID, preferredTherapistID)
		if err != nil {
			return nil, err
		}
		if t == nil {
			return nil, ErrSlotTaken
		}
		return []Therapist{*t}, nil
	}
	return getEligibleTherapists(ctx, tx, branchID, serviceID)
}

// CancelBooking moves a booking to CANCELLED if it's currently in a cancellable state.
func (s *Service) CancelBooking(ctx context.Context, bookingID, reason string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	b, err := getBookingByID(ctx, tx, bookingID)
	if err != nil {
		return err
	}
	if !isCancellable(b.Status) {
		return fmt.Errorf("%w: booking cannot be cancelled from status %s", ErrValidation, b.Status)
	}

	if err := updateBookingStatus(ctx, tx, bookingID, StatusCancelled, reason); err != nil {
		return err
	}
	afterData := fmt.Sprintf(`{"status":"%s"}`, StatusCancelled)
	if err := insertAuditLog(ctx, tx, b.BranchID, "CANCEL_BOOKING", "Booking", bookingID, []byte(afterData)); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func isCancellable(status Status) bool {
	for _, s := range cancellableStatuses {
		if s == status {
			return true
		}
	}
	return false
}

func isExclusionViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == postgresExclusionViolation
}

func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == postgresUniqueViolation && pgErr.ConstraintName == constraint
}
