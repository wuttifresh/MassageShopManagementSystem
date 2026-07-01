import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sendLineMessage } from "@/lib/line-messaging";
import { prisma } from "@/lib/prisma";

// Without this, Next.js treats the GET handler as static (no dynamic API calls detected) and
// bakes in a single prerendered response at build time — a cron endpoint must run fresh every
// invocation to see the current time and DB state.
export const dynamic = "force-dynamic";

const REMINDER_WINDOW_MINUTES = 30;

function formatThaiTime(date: Date): string {
  return date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/// Meant to be hit every ~10 minutes (see .github/workflows/reminders.yml — Vercel Hobby's Cron
/// only supports daily schedules, too coarse for this). Finds confirmed bookings starting within
/// the next 30 minutes that haven't been reminded yet and pings the customer on LINE.
///
/// `reminderSentAt` is set right after each send so overlapping/retried runs never double-send —
/// this is the only guard needed since a single booking can only match the time window once.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60_000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      deletedAt: null,
      reminderSentAt: null,
      startTime: { gte: now, lte: windowEnd },
      customer: { lineUserId: { not: null } },
    },
    include: { customer: true, branch: true, serviceOption: { include: { service: true } } },
  });

  let remindersSent = 0;
  for (const booking of bookings) {
    if (!booking.customer?.lineUserId) continue;

    await sendLineMessage(
      booking.customer.lineUserId,
      `⏰ ใกล้ถึงเวลานัดของคุณแล้ว\nบริการ: ${booking.serviceOption.service.name}\nสาขา: ${booking.branch.name}\nเวลา: ${formatThaiTime(booking.startTime)}`
    );

    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: new Date() },
    });

    remindersSent += 1;
  }

  return NextResponse.json({ remindersSent });
}
