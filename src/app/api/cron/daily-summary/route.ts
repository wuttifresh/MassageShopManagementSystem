import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sendLineMessage } from "@/lib/line-messaging";
import { getSalesReport } from "@/lib/reports";
import { prisma } from "@/lib/prisma";

// Without this, Next.js treats the GET handler as static (no dynamic API calls detected) and
// bakes in a single prerendered response at build time — a cron endpoint must run fresh every
// invocation to see today's date and current DB state.
export const dynamic = "force-dynamic";

const CURRENCY_FORMAT = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function todayRange(): { startDate: Date; endDate: Date } {
  const startDate = new Date(new Date().toISOString().slice(0, 10));
  const endDate = new Date(startDate.getTime() + 86_400_000);
  return { startDate, endDate };
}

/// Scheduled once daily via vercel.json (Vercel Hobby's Cron minimum interval is 1/day, which is
/// exactly what this needs). Sends every OWNER with a linked LINE account today's combined
/// sales summary plus a per-branch breakdown — matches the "สรุปยอดสิ้นวันให้เจ้าของ" requirement.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { startDate, endDate } = todayRange();

  const [overall, branches, owners] = await Promise.all([
    getSalesReport({ startDate, endDate }),
    prisma.branch.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "OWNER", deletedAt: null, lineUserId: { not: null } } }),
  ]);

  if (owners.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no OWNER with lineUserId configured" });
  }

  const perBranchLines = await Promise.all(
    branches.map(async (branch) => {
      const report = await getSalesReport({ branchId: branch.id, startDate, endDate });
      return `- ${branch.name}: ฿${CURRENCY_FORMAT.format(report.summary.totalRevenue)} (${report.summary.transactionCount} บิล)`;
    })
  );

  const dateLabel = startDate.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" });
  const text = [
    `📊 สรุปยอดขายวันที่ ${dateLabel}`,
    `ยอดขายรวม: ฿${CURRENCY_FORMAT.format(overall.summary.totalRevenue)} (${overall.summary.transactionCount} บิล)`,
    `ค่ามือรวม: ฿${CURRENCY_FORMAT.format(overall.summary.totalCommission)}`,
    "",
    "แยกตามสาขา:",
    ...perBranchLines,
  ].join("\n");

  let sent = 0;
  for (const owner of owners) {
    if (!owner.lineUserId) continue;
    await sendLineMessage(owner.lineUserId, text);
    sent += 1;
  }

  return NextResponse.json({ sent });
}
