package booking

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"
)

type Handlers struct {
	svc *Service
}

func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc}
}

func (h *Handlers) Register(router fiber.Router) {
	router.Get("/availability", h.getAvailability)
	router.Post("/bookings", h.createBooking)
	router.Post("/bookings/:id/cancel", h.cancelBooking)
}

func (h *Handlers) getAvailability(c *fiber.Ctx) error {
	branchID := c.Query("branchId")
	serviceOptionID := c.Query("serviceOptionId")
	therapistID := c.Query("therapistId") // omitted/empty = "any therapist"
	dateParam := c.Query("date")          // YYYY-MM-DD

	if branchID == "" || serviceOptionID == "" || dateParam == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "branchId, serviceOptionId and date are required"})
	}
	date, err := time.ParseInLocation("2006-01-02", dateParam, time.UTC)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid date format (expected YYYY-MM-DD)"})
	}

	slots, err := h.svc.GetAvailableSlots(c.Context(), branchID, serviceOptionID, therapistID, date)
	if err != nil {
		if errors.Is(err, ErrValidation) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return err
	}

	out := make([]string, len(slots))
	for i, s := range slots {
		out[i] = s.Format("15:04")
	}
	return c.JSON(fiber.Map{"slots": out})
}

type createBookingRequest struct {
	BranchID        string  `json:"branchId"`
	ServiceOptionID string  `json:"serviceOptionId"`
	TherapistID     string  `json:"therapistId"`
	Date            string  `json:"date"`
	Time            string  `json:"time"`
	GuestName       string  `json:"guestName"`
	GuestPhone      *string `json:"guestPhone"`
	Source          string  `json:"source"`
}

func (h *Handlers) createBooking(c *fiber.Ctx) error {
	var req createBookingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if req.BranchID == "" || req.ServiceOptionID == "" || req.Date == "" || req.Time == "" || req.GuestName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "branchId, serviceOptionId, date, time and guestName are required",
		})
	}

	booking, err := h.svc.CreateBooking(c.Context(), CreateInput{
		BranchID:        req.BranchID,
		ServiceOptionID: req.ServiceOptionID,
		TherapistID:     req.TherapistID,
		Date:            req.Date,
		Time:            req.Time,
		GuestName:       req.GuestName,
		GuestPhone:      req.GuestPhone,
		Source:          req.Source,
	})
	if err != nil {
		if errors.Is(err, ErrSlotTaken) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "that slot is no longer available, please choose another time"})
		}
		if errors.Is(err, ErrValidation) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return err
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"bookingId": booking.ID,
		"code":      booking.Code,
		"startTime": booking.StartTime,
		"endTime":   booking.EndTime,
	})
}

type cancelBookingRequest struct {
	Reason string `json:"reason"`
}

func (h *Handlers) cancelBooking(c *fiber.Ctx) error {
	id := c.Params("id")
	var req cancelBookingRequest
	_ = c.BodyParser(&req) // reason is optional

	err := h.svc.CancelBooking(c.Context(), id, req.Reason)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "booking not found"})
		}
		if errors.Is(err, ErrValidation) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		}
		return err
	}

	return c.JSON(fiber.Map{"ok": true})
}
