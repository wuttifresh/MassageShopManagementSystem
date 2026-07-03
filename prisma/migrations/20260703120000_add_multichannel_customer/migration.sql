-- CreateEnum
CREATE TYPE "channel" AS ENUM ('LINE', 'WHATSAPP');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "channel" "channel" NOT NULL,
    "channel_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_channel_channel_user_id_key" ON "customers"("channel", "channel_user_id");

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "channel_customer_id" TEXT,
ADD COLUMN     "channel" "channel",
ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_channel_customer_id_fkey" FOREIGN KEY ("channel_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
