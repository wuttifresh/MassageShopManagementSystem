-- AlterEnum
-- Adds a value to an existing enum rather than a new table (multi-channel-booking-prompt.md,
-- Phase 5: outbound-notification logging reuses AuditLog instead of a dedicated model). Must be
-- the only statement in this migration file: Postgres forbids using a newly added enum value in
-- the same transaction that added it, and Prisma applies each migration file as one transaction.
ALTER TYPE "audit_action" ADD VALUE 'SEND_NOTIFICATION';
