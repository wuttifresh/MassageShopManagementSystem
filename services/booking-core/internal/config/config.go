// Package config reads process environment into a typed struct. Kept deliberately tiny — this
// service has three knobs, not a framework's worth.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	// Same Postgres database the existing Next.js/Prisma app uses (see prisma/schema.prisma at
	// the repo root) — this service reads/writes the same `bookings`/`therapists`/etc. tables,
	// it does not own a separate schema or run its own migrations.
	DatabaseURL string
	Port        string
}

func Load() (Config, error) {
	cfg := Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Port:        os.Getenv("PORT"),
	}
	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is not set")
	}
	if cfg.Port == "" {
		cfg.Port = "8081"
	}
	return cfg, nil
}
