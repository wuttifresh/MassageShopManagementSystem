-- CreateEnum
CREATE TYPE "role" AS ENUM ('OWNER', 'STAFF', 'THERAPIST', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "booking_source" AS ENUM ('ONLINE', 'WALK_IN', 'PHONE', 'ADMIN');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "queue_status" AS ENUM ('WAITING', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "therapist_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "commission_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "schedule_status" AS ENUM ('WORKING', 'DAY_OFF', 'LEAVE');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'TRANSFER', 'PROMPTPAY', 'CARD');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('PENDING', 'PAID', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "package_status" AS ENUM ('ACTIVE', 'EXPIRED', 'FULLY_USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "membership_tier" AS ENUM ('STANDARD', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VOID', 'REFUND', 'CHECK_IN', 'CHECK_OUT', 'ASSIGN_THERAPIST', 'CANCEL_BOOKING', 'RESCHEDULE_BOOKING', 'REDEEM_PACKAGE', 'ADJUST_POINTS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "phone" TEXT,
    "line_user_id" TEXT,
    "line_display_name" TEXT,
    "image" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "branch_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "open_time" TEXT NOT NULL DEFAULT '10:00',
    "close_time" TEXT NOT NULL DEFAULT '22:00',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_options" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "bio" TEXT,
    "status" "therapist_status" NOT NULL DEFAULT 'ACTIVE',
    "commission_type" "commission_type" NOT NULL DEFAULT 'PERCENTAGE',
    "commission_rate" DECIMAL(10,2) NOT NULL,
    "rating_average" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "hired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist_services" (
    "therapist_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "commission_rate_override" DECIMAL(10,2),

    CONSTRAINT "therapist_services_pkey" PRIMARY KEY ("therapist_id","service_id")
);

-- CreateTable
CREATE TABLE "therapist_schedules" (
    "id" TEXT NOT NULL,
    "therapist_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "status" "schedule_status" NOT NULL DEFAULT 'WORKING',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapist_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "guest_name" TEXT,
    "guest_phone" TEXT,
    "service_option_id" TEXT NOT NULL,
    "therapist_id" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'PENDING',
    "source" "booking_source" NOT NULL DEFAULT 'ONLINE',
    "notes" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "rescheduled_from_id" TEXT,
    "created_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queues" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "customer_id" TEXT,
    "guest_name" TEXT,
    "guest_phone" TEXT,
    "service_option_id" TEXT NOT NULL,
    "therapist_id" TEXT,
    "queue_number" TEXT NOT NULL,
    "bed_label" TEXT,
    "status" "queue_status" NOT NULL DEFAULT 'WAITING',
    "checked_in_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "queue_id" TEXT,
    "receipt_no" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "vat_amount" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "status" "transaction_status" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_items" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "service_option_id" TEXT NOT NULL,
    "therapist_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_snapshot" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,
    "commission_type" "commission_type",
    "commission_rate" DECIMAL(10,2),
    "commission_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" "membership_tier" NOT NULL DEFAULT 'STANDARD',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_id" TEXT,
    "name" TEXT NOT NULL,
    "total_sessions" INTEGER NOT NULL,
    "remaining_sessions" INTEGER NOT NULL,
    "price_paid" DECIMAL(10,2) NOT NULL,
    "status" "package_status" NOT NULL DEFAULT 'ACTIVE',
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "sold_by_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_usages" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "transaction_item_id" TEXT,
    "sessions_used" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" "role",
    "branch_id" TEXT,
    "action" "audit_action" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_line_user_id_key" ON "users"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_slug_key" ON "branches"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_options_service_id_duration_minutes_key" ON "service_options"("service_id", "duration_minutes");

-- CreateIndex
CREATE UNIQUE INDEX "therapists_user_id_key" ON "therapists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "therapist_schedules_therapist_id_date_key" ON "therapist_schedules"("therapist_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_rescheduled_from_id_key" ON "bookings"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "bookings_branch_id_start_time_idx" ON "bookings"("branch_id", "start_time");

-- CreateIndex
CREATE INDEX "bookings_therapist_id_start_time_idx" ON "bookings"("therapist_id", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "queues_booking_id_key" ON "queues"("booking_id");

-- CreateIndex
CREATE INDEX "queues_branch_id_status_idx" ON "queues"("branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "queues_branch_id_queue_number_created_at_key" ON "queues"("branch_id", "queue_number", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_queue_id_key" ON "transactions"("queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_receipt_no_key" ON "transactions"("receipt_no");

-- CreateIndex
CREATE INDEX "transactions_branch_id_created_at_idx" ON "transactions"("branch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_customer_id_key" ON "memberships"("customer_id");

-- CreateIndex
CREATE INDEX "packages_customer_id_idx" ON "packages"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_usages_transaction_item_id_key" ON "package_usages"("transaction_item_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_branch_id_created_at_idx" ON "audit_logs"("branch_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_options" ADD CONSTRAINT "service_options_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapists" ADD CONSTRAINT "therapists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapists" ADD CONSTRAINT "therapists_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_services" ADD CONSTRAINT "therapist_services_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_services" ADD CONSTRAINT "therapist_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_schedules" ADD CONSTRAINT "therapist_schedules_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_schedules" ADD CONSTRAINT "therapist_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_option_id_fkey" FOREIGN KEY ("service_option_id") REFERENCES "service_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_service_option_id_fkey" FOREIGN KEY ("service_option_id") REFERENCES "service_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_service_option_id_fkey" FOREIGN KEY ("service_option_id") REFERENCES "service_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "therapists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_sold_by_id_fkey" FOREIGN KEY ("sold_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_usages" ADD CONSTRAINT "package_usages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_usages" ADD CONSTRAINT "package_usages_transaction_item_id_fkey" FOREIGN KEY ("transaction_item_id") REFERENCES "transaction_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Hard rule #6: block double-booking at the database level.
--
-- Prisma's schema DSL cannot express PostgreSQL EXCLUDE constraints, so this
-- is hand-written SQL appended to the generated migration. It guarantees
-- that no two active (non-cancelled, non-deleted) bookings for the same
-- therapist can have overlapping [start_time, end_time) ranges, even under
-- concurrent writes — this is enforced by Postgres itself, not by
-- application-level locking, so it holds regardless of race conditions.
-- ─────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_therapist_overlap"
  EXCLUDE USING gist (
    "therapist_id" WITH =,
    tsrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE (
    "therapist_id" IS NOT NULL
    AND "deleted_at" IS NULL
    AND "status" NOT IN ('CANCELLED', 'NO_SHOW', 'RESCHEDULED')
  );
