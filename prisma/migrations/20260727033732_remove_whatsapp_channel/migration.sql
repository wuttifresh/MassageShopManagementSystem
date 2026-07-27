-- Removes the WhatsApp booking channel and its supporting phone-OTP verification step.
-- Postgres has no `ALTER TYPE ... DROP VALUE`, so the enum is rebuilt without WHATSAPP via the
-- standard rename/create/swap/drop pattern. The guard clause below fails loudly instead of
-- letting the USING cast fail obscurely if any row still references the value being dropped.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "customers" WHERE "channel" = 'WHATSAPP')
     OR EXISTS (SELECT 1 FROM "bookings" WHERE "channel" = 'WHATSAPP') THEN
    RAISE EXCEPTION 'Cannot drop WHATSAPP from channel enum: rows still reference it';
  END IF;
END $$;

ALTER TYPE "channel" RENAME TO "channel_old";

CREATE TYPE "channel" AS ENUM ('LINE', 'WEB');

ALTER TABLE "customers" ALTER COLUMN "channel" TYPE "channel" USING ("channel"::text::"channel");
ALTER TABLE "bookings" ALTER COLUMN "channel" TYPE "channel" USING ("channel"::text::"channel");

DROP TYPE "channel_old";

-- /book-now's phone-verification step (src/lib/phone-otp.ts, which sent the OTP via WhatsApp) is
-- removed entirely rather than re-routed to another channel.
DROP TABLE "phone_otp_challenges";
