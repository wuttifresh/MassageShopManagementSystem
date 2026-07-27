package booking

import (
	"errors"
	"time"
)

// Booking statuses match the Postgres enum `booking_status` in prisma/schema.prisma exactly —
// this service writes to the same column, so the values must stay in lockstep with that enum.
// CHECKED_IN / IN_SERVICE (mentioned in the Phase 1 brief) live on the separate `Queue` model,
// not here — the existing Booking/Queue split is intentionally kept (Booking = the advance
// reservation, Queue = today's operational walk-through of check-in → in-service → done). This
// service only owns Booking; Queue is out of scope for Phase 1.
type Status string

const (
	StatusPending     Status = "PENDING"
	StatusConfirmed   Status = "CONFIRMED"
	StatusCancelled   Status = "CANCELLED"
	StatusNoShow      Status = "NO_SHOW"
	StatusCompleted   Status = "COMPLETED"
	StatusRescheduled Status = "RESCHEDULED"
)

// activeStatuses are the booking states that still hold a therapist's time and must be counted
// when checking for overlaps — mirrors ACTIVE_BOOKING_STATUSES in src/lib/availability.ts.
var activeStatuses = []Status{StatusPending, StatusConfirmed}

// cancellableStatuses are the only states a booking can move out of via Cancel.
var cancellableStatuses = []Status{StatusPending, StatusConfirmed}

var (
	// ErrValidation is bad input the caller should have avoided (unknown branch/service option,
	// booking below the minimum lead time, etc.) — callers map this to HTTP 400.
	ErrValidation = errors.New("booking: validation error")
	// ErrSlotTaken means no therapist was free for the requested slot — either the app-level
	// check found nobody free, or (the real guarantee) the database's EXCLUDE constraint
	// rejected a race-condition double-booking. Callers map this to HTTP 409.
	ErrSlotTaken = errors.New("booking: slot no longer available")
	// ErrNotFound means the booking id doesn't exist (or is soft-deleted).
	ErrNotFound = errors.New("booking: not found")
)

// CustomerIdentity is who a booking is for. Exactly one shape is expected at a time, mirroring
// BookingCustomerIdentity's "channel" variant in src/lib/booking-service.ts:
//   - Channel + ChannelUserID set: upserts a `customers` row keyed by (channel, channel_user_id)
//     and links it via the booking's channel_customer_id — used by /book-now (Channel="WEB",
//     ChannelUserID=the normalized phone) today, and by Phase 3's LINE adapters later, so
//     channel-based bookings only need to be created one way, not reimplemented per channel.
//   - Channel empty: Name/Phone are written directly onto the booking's guest_name/guest_phone
//     columns instead — the legacy phone-in/no-identity-system path.
type CustomerIdentity struct {
	Channel       string
	ChannelUserID string
	Name          string
	Phone         *string
}

type Booking struct {
	ID                string
	BranchID          string
	ServiceOptionID   string
	TherapistID       *string
	GuestName         *string
	GuestPhone        *string
	Channel           *string
	ChannelCustomerID *string
	Code              string
	StartTime         time.Time
	EndTime           time.Time
	Status            Status
	Source            string
}

type TimeRange struct {
	Start time.Time
	End   time.Time
}

type ServiceOption struct {
	ID              string
	ServiceID       string
	DurationMinutes int
	IsActive        bool
}

type Therapist struct {
	ID       string
	Nickname string
}
