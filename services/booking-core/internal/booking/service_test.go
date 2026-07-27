package booking

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// These are integration tests against a real Postgres database (same schema the Next.js/Prisma
// app owns — see prisma/schema.prisma at the repo root). Set TEST_DATABASE_URL to point at it;
// skipped automatically if unset so `go test ./...` doesn't fail in environments with no DB.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping integration test")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// testFixture is one branch + one service/service option + one therapist, working all day every
// day starting today, with no bookings yet — enough to exercise availability/create/cancel.
type testFixture struct {
	BranchID        string
	ServiceOptionID string
	ServiceID       string
	TherapistID     string
	Date            time.Time // truncated to UTC midnight, "today" for the lead-time check
}

func setupFixture(t *testing.T, pool *pgxpool.Pool) testFixture {
	t.Helper()
	ctx := context.Background()

	f := testFixture{
		BranchID:        uuid.NewString(),
		ServiceOptionID: uuid.NewString(),
		ServiceID:       uuid.NewString(),
		TherapistID:     uuid.NewString(),
		// Tomorrow, not today: CreateBooking enforces a 60-minute minimum lead time, and a
		// same-day working window starting at 00:00 could still fall inside that window.
		Date: time.Now().UTC().Add(24 * time.Hour).Truncate(24 * time.Hour),
	}

	mustExec(t, ctx, pool, `INSERT INTO branches (id, name, slug, updated_at) VALUES ($1, 'Test Branch', $2, now())`,
		f.BranchID, "test-branch-"+f.BranchID)
	mustExec(t, ctx, pool, `INSERT INTO services (id, name, updated_at) VALUES ($1, 'Test Service', now())`, f.ServiceID)
	mustExec(t, ctx, pool, `
		INSERT INTO service_options (id, service_id, duration_minutes, price, updated_at)
		VALUES ($1, $2, 60, 300, now())`, f.ServiceOptionID, f.ServiceID)
	mustExec(t, ctx, pool, `
		INSERT INTO therapists (id, branch_id, nickname, commission_rate, updated_at)
		VALUES ($1, $2, 'Test Therapist', 40, now())`, f.TherapistID, f.BranchID)
	mustExec(t, ctx, pool, `
		INSERT INTO therapist_schedules (id, therapist_id, branch_id, date, start_time, end_time, updated_at)
		VALUES ($1, $2, $3, $4, '00:00', '23:30', now())`,
		uuid.NewString(), f.TherapistID, f.BranchID, f.Date)

	t.Cleanup(func() {
		mustExec(t, ctx, pool, `DELETE FROM bookings WHERE branch_id = $1`, f.BranchID)
		mustExec(t, ctx, pool, `DELETE FROM customers WHERE channel_user_id LIKE 'test-%'`)
		mustExec(t, ctx, pool, `DELETE FROM audit_logs WHERE branch_id = $1`, f.BranchID)
		mustExec(t, ctx, pool, `DELETE FROM therapist_time_blocks WHERE branch_id = $1`, f.BranchID)
		mustExec(t, ctx, pool, `DELETE FROM therapist_schedules WHERE branch_id = $1`, f.BranchID)
		mustExec(t, ctx, pool, `DELETE FROM therapists WHERE branch_id = $1`, f.BranchID)
		mustExec(t, ctx, pool, `DELETE FROM service_options WHERE service_id = $1`, f.ServiceID)
		mustExec(t, ctx, pool, `DELETE FROM services WHERE id = $1`, f.ServiceID)
		mustExec(t, ctx, pool, `DELETE FROM branches WHERE id = $1`, f.BranchID)
	})

	return f
}

func mustExec(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(ctx, sql, args...); err != nil {
		t.Fatalf("fixture setup/teardown query failed: %v\nsql: %s", err, sql)
	}
}

func TestCreateBooking_Success(t *testing.T) {
	pool := testPool(t)
	f := setupFixture(t, pool)
	svc := NewService(pool)

	booking, err := svc.CreateBooking(context.Background(), CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     f.TherapistID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "10:00",
		Customer:        CustomerIdentity{Name: "Somchai"},
	})
	if err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}
	if booking.Status != StatusConfirmed {
		t.Errorf("status = %s, want CONFIRMED", booking.Status)
	}
	if booking.Code == "" {
		t.Error("expected a non-empty booking code")
	}
}

func TestCreateBooking_ChannelCustomer(t *testing.T) {
	pool := testPool(t)
	f := setupFixture(t, pool)
	svc := NewService(pool)
	ctx := context.Background()

	channelUserID := "test-" + uuid.NewString()
	booking, err := svc.CreateBooking(ctx, CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     f.TherapistID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "09:00",
		Customer:        CustomerIdentity{Channel: "WEB", ChannelUserID: channelUserID, Name: "Somchai"},
	})
	if err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}
	if booking.Channel == nil || *booking.Channel != "WEB" {
		t.Errorf("channel = %v, want WEB", booking.Channel)
	}
	if booking.ChannelCustomerID == nil || *booking.ChannelCustomerID == "" {
		t.Error("expected a non-nil channelCustomerId")
	}
	if booking.GuestName != nil {
		t.Errorf("guestName = %v, want nil for a channel-linked booking", booking.GuestName)
	}

	// The customer row should be upserted, not duplicated, on a second booking with the same
	// (channel, channelUserId) — mirrors createBooking's Customer.upsert in
	// src/lib/booking-service.ts.
	var customerCount int
	err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM customers WHERE channel = 'WEB'::channel AND channel_user_id = $1`, channelUserID).
		Scan(&customerCount)
	if err != nil {
		t.Fatalf("count query: %v", err)
	}
	if customerCount != 1 {
		t.Errorf("customer row count = %d, want 1", customerCount)
	}
}

func TestCreateBooking_RejectsOverlapAfterFirstBooking(t *testing.T) {
	pool := testPool(t)
	f := setupFixture(t, pool)
	svc := NewService(pool)
	ctx := context.Background()

	in := CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     f.TherapistID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "10:00",
		Customer:        CustomerIdentity{Name: "First customer"},
	}
	if _, err := svc.CreateBooking(ctx, in); err != nil {
		t.Fatalf("first CreateBooking: %v", err)
	}

	in.Customer = CustomerIdentity{Name: "Second customer"}
	_, err := svc.CreateBooking(ctx, in)
	if !errors.Is(err, ErrSlotTaken) {
		t.Fatalf("second CreateBooking error = %v, want ErrSlotTaken", err)
	}
}

func TestCancelBooking(t *testing.T) {
	pool := testPool(t)
	f := setupFixture(t, pool)
	svc := NewService(pool)
	ctx := context.Background()

	booking, err := svc.CreateBooking(ctx, CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     f.TherapistID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "11:00",
		Customer:        CustomerIdentity{Name: "Somchai"},
	})
	if err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}

	if err := svc.CancelBooking(ctx, booking.ID, "customer requested"); err != nil {
		t.Fatalf("CancelBooking: %v", err)
	}

	// Cancelling twice should fail — it's no longer in a cancellable state.
	err = svc.CancelBooking(ctx, booking.ID, "again")
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("second cancel error = %v, want ErrValidation", err)
	}

	// The freed-up slot should become bookable again by someone else.
	_, err = svc.CreateBooking(ctx, CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     f.TherapistID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "11:00",
		Customer:        CustomerIdentity{Name: "Someone else"},
	})
	if err != nil {
		t.Fatalf("re-booking the freed slot: %v", err)
	}
}

// TestCreateBooking_DoubleBookingRace is the test the Phase 1 brief explicitly asked for: fire N
// concurrent requests at the exact same therapist/slot and prove that exactly one succeeds — the
// Postgres advisory lock in lockTherapistForBooking serializes them, and the
// bookings_no_therapist_overlap EXCLUDE constraint is the backstop if it somehow didn't.
func TestCreateBooking_DoubleBookingRace(t *testing.T) {
	pool := testPool(t)
	f := setupFixture(t, pool)
	svc := NewService(pool)
	ctx := context.Background()

	const concurrency = 20
	var wg sync.WaitGroup
	results := make([]error, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := svc.CreateBooking(ctx, CreateInput{
				BranchID:        f.BranchID,
				ServiceOptionID: f.ServiceOptionID,
				TherapistID:     f.TherapistID,
				Date:            f.Date.Format("2006-01-02"),
				Time:            "14:00",
				Customer:        CustomerIdentity{Name: fmt.Sprintf("customer-%d", i)},
			})
			results[i] = err
		}(i)
	}
	wg.Wait()

	successes, slotTaken, unexpected := 0, 0, 0
	for _, err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, ErrSlotTaken):
			slotTaken++
		default:
			unexpected++
			t.Logf("unexpected error: %v", err)
		}
	}

	if successes != 1 {
		t.Errorf("successes = %d, want exactly 1 (double-booking protection failed)", successes)
	}
	if slotTaken != concurrency-1 {
		t.Errorf("slotTaken = %d, want %d", slotTaken, concurrency-1)
	}
	if unexpected != 0 {
		t.Errorf("unexpected != 0: %d requests failed with an error other than ErrSlotTaken", unexpected)
	}

	// Belt-and-suspenders: confirm the database itself agrees there's exactly one active booking
	// for this therapist at this exact time, not just that the Go layer reported one success.
	var count int
	startTime, _ := combineDateAndTime(f.Date, "14:00")
	err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM bookings
		WHERE therapist_id = $1 AND start_time = $2 AND status IN ('PENDING', 'CONFIRMED') AND deleted_at IS NULL`,
		f.TherapistID, startTime,
	).Scan(&count)
	if err != nil {
		t.Fatalf("count query: %v", err)
	}
	if count != 1 {
		t.Errorf("db row count = %d, want 1", count)
	}
}

func TestGetAvailableSlots_ExcludesBookedRange(t *testing.T) {
	pool := testPool(t)
	f := setupFixture(t, pool)
	svc := NewService(pool)
	ctx := context.Background()

	before, err := svc.GetAvailableSlots(ctx, f.BranchID, f.ServiceOptionID, f.TherapistID, f.Date)
	if err != nil {
		t.Fatalf("GetAvailableSlots (before): %v", err)
	}
	if !containsTime(before, "15:00") {
		t.Fatalf("expected 15:00 to be free before booking it")
	}

	if _, err := svc.CreateBooking(ctx, CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     f.TherapistID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "15:00",
		Customer:        CustomerIdentity{Name: "Somchai"},
	}); err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}

	after, err := svc.GetAvailableSlots(ctx, f.BranchID, f.ServiceOptionID, f.TherapistID, f.Date)
	if err != nil {
		t.Fatalf("GetAvailableSlots (after): %v", err)
	}
	if containsTime(after, "15:00") {
		t.Errorf("15:00 should no longer be available after booking it")
	}
}

// TestGetAvailableSlots_ExcludesTimeBlock proves the same overlap guard used for bookings also
// applies to therapist_time_blocks (Phase 5 — lunch break, personal appointment, etc.), mirroring
// the TS test in src/lib/__tests__/availability.test.ts ("excludes slots that would overlap a
// blocked range ... exactly like a booking").
func TestGetAvailableSlots_ExcludesTimeBlock(t *testing.T) {
	pool := testPool(t)
	f := setupFixture(t, pool)
	svc := NewService(pool)
	ctx := context.Background()

	before, err := svc.GetAvailableSlots(ctx, f.BranchID, f.ServiceOptionID, f.TherapistID, f.Date)
	if err != nil {
		t.Fatalf("GetAvailableSlots (before): %v", err)
	}
	if !containsTime(before, "15:00") {
		t.Fatalf("expected 15:00 to be free before blocking it")
	}

	mustExec(t, ctx, pool, `
		INSERT INTO therapist_time_blocks (id, therapist_id, branch_id, date, start_time, end_time, updated_at)
		VALUES ($1, $2, $3, $4, '15:00', '16:00', now())`,
		uuid.NewString(), f.TherapistID, f.BranchID, f.Date)

	after, err := svc.GetAvailableSlots(ctx, f.BranchID, f.ServiceOptionID, f.TherapistID, f.Date)
	if err != nil {
		t.Fatalf("GetAvailableSlots (after): %v", err)
	}
	if containsTime(after, "15:00") {
		t.Errorf("15:00 should no longer be available once it falls inside a time block")
	}

	if _, err := svc.CreateBooking(ctx, CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     f.TherapistID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "15:00",
		Customer:        CustomerIdentity{Name: "Somchai"},
	}); !errors.Is(err, ErrSlotTaken) {
		t.Errorf("expected CreateBooking to reject a slot inside a time block with ErrSlotTaken, got: %v", err)
	}
}

// TestGetAvailableSlots_AnyTherapist_UnionAcrossTherapists exercises getAnyTherapistSlots's
// batched query path (getWorkingWindowsBulk/getBusyRangesBulk) with more than one eligible
// therapist, proving the union behaves the same as the old per-therapist loop: a slot stays
// available as long as at least one eligible therapist is free for it.
func TestGetAvailableSlots_AnyTherapist_UnionAcrossTherapists(t *testing.T) {
	pool := testPool(t)
	f := setupFixture(t, pool)
	svc := NewService(pool)
	ctx := context.Background()

	therapist2ID := uuid.NewString()
	mustExec(t, ctx, pool, `
		INSERT INTO therapists (id, branch_id, nickname, commission_rate, updated_at)
		VALUES ($1, $2, 'Test Therapist 2', 40, now())`, therapist2ID, f.BranchID)
	mustExec(t, ctx, pool, `
		INSERT INTO therapist_schedules (id, therapist_id, branch_id, date, start_time, end_time, updated_at)
		VALUES ($1, $2, $3, $4, '00:00', '23:30', now())`,
		uuid.NewString(), therapist2ID, f.BranchID, f.Date)
	t.Cleanup(func() {
		mustExec(t, context.Background(), pool, `DELETE FROM therapist_schedules WHERE therapist_id = $1`, therapist2ID)
		mustExec(t, context.Background(), pool, `DELETE FROM therapists WHERE id = $1`, therapist2ID)
	})

	// Book the original therapist at 15:00, leaving therapist 2 free at that time.
	if _, err := svc.CreateBooking(ctx, CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     f.TherapistID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "15:00",
		Customer:        CustomerIdentity{Name: "Somchai"},
	}); err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}

	// "any therapist" (empty TherapistID) should still offer 15:00, backed by therapist 2 alone.
	slots, err := svc.GetAvailableSlots(ctx, f.BranchID, f.ServiceOptionID, "", f.Date)
	if err != nil {
		t.Fatalf("GetAvailableSlots: %v", err)
	}
	if !containsTime(slots, "15:00") {
		t.Errorf("expected 15:00 to still be available via the second therapist, got slots: %v", slots)
	}

	// Now book therapist 2 at 15:00 too — nobody is free anymore.
	if _, err := svc.CreateBooking(ctx, CreateInput{
		BranchID:        f.BranchID,
		ServiceOptionID: f.ServiceOptionID,
		TherapistID:     therapist2ID,
		Date:            f.Date.Format("2006-01-02"),
		Time:            "15:00",
		Customer:        CustomerIdentity{Name: "Malee"},
	}); err != nil {
		t.Fatalf("CreateBooking (therapist 2): %v", err)
	}

	slots, err = svc.GetAvailableSlots(ctx, f.BranchID, f.ServiceOptionID, "", f.Date)
	if err != nil {
		t.Fatalf("GetAvailableSlots (after both booked): %v", err)
	}
	if containsTime(slots, "15:00") {
		t.Errorf("15:00 should no longer be available once both eligible therapists are booked")
	}
}

func containsTime(slots []time.Time, hhmm string) bool {
	for _, s := range slots {
		if s.Format("15:04") == hhmm {
			return true
		}
	}
	return false
}
