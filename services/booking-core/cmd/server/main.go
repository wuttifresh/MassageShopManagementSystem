// Command server runs the booking-core HTTP API (Phase 1 of the migration plan) — slot
// availability, create booking, cancel booking. It connects to the same Postgres database the
// existing Next.js/Prisma app uses; see ../../internal/booking for the actual logic.
package main

import (
	"context"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/wuttifresh/massageshopmanagementsystem/services/booking-core/internal/booking"
	"github.com/wuttifresh/massageshopmanagementsystem/services/booking-core/internal/config"
	"github.com/wuttifresh/massageshopmanagementsystem/services/booking-core/internal/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	svc := booking.NewService(pool)
	handlers := booking.NewHandlers(svc)

	app := fiber.New()
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})

	v1 := app.Group("/v1")
	handlers.Register(v1)

	log.Printf("booking-core listening on :%s", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
