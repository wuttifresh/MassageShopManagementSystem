import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { getSalesReport } from "@/lib/reports";
import { ReportFilterForm } from "./report-filter-form";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(): { startDate: string; endDate: string } {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const start = new Date(today.getTime() - 29 * 86_400_000);
  return { startDate: isoDate(start), endDate: isoDate(today) };
}

const NUMBER_FORMAT = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DAY_FORMAT = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { branchId?: string; startDate?: string; endDate?: string };
}) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/reports");
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  const activeBranchId = await resolveActiveBranchId(session.user, searchParams.branchId);
  if (!activeBranchId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4">
        <p>ยังไม่มีสาขาที่ใช้งานอยู่</p>
      </main>
    );
  }

  const defaults = defaultDateRange();
  const startDate = searchParams.startDate ?? defaults.startDate;
  const endDate = searchParams.endDate ?? defaults.endDate;

  const report = await getSalesReport({
    branchId: activeBranchId,
    startDate: new Date(startDate),
    endDate: new Date(new Date(endDate).getTime() + 86_400_000),
  });

  const exportUrl = `/api/reports/export?branchId=${activeBranchId}&startDate=${startDate}&endDate=${endDate}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-400">
            ← กลับแดชบอร์ด
          </Link>
          <h1 className="text-xl font-semibold">รายงานยอดขาย</h1>
        </div>
        <a
          href={exportUrl}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white"
        >
          ส่งออก Excel
        </a>
      </div>

      <ReportFilterForm
        branches={branches}
        activeBranchId={activeBranchId}
        startDate={startDate}
        endDate={endDate}
        showBranchPicker={session.user.role === "OWNER"}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 p-3">
          <p className="text-xs text-neutral-500">ยอดขายรวม</p>
          <p className="text-lg font-semibold">฿{NUMBER_FORMAT.format(report.summary.totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-3">
          <p className="text-xs text-neutral-500">จำนวนบิล</p>
          <p className="text-lg font-semibold">{report.summary.transactionCount}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-3">
          <p className="text-xs text-neutral-500">VAT รวม</p>
          <p className="text-lg font-semibold">฿{NUMBER_FORMAT.format(report.summary.totalVat)}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-3">
          <p className="text-xs text-neutral-500">ค่ามือรวม</p>
          <p className="text-lg font-semibold">฿{NUMBER_FORMAT.format(report.summary.totalCommission)}</p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">ยอดขายตามบริการ</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="pb-1">บริการ</th>
              <th className="pb-1 text-right">จำนวน</th>
              <th className="pb-1 text-right">ยอดขาย</th>
            </tr>
          </thead>
          <tbody>
            {report.byService.map((row) => (
              <tr key={row.serviceId} className="border-t border-neutral-100">
                <td className="py-1">{row.serviceName}</td>
                <td className="py-1 text-right">{row.quantity}</td>
                <td className="py-1 text-right">฿{NUMBER_FORMAT.format(row.revenue)}</td>
              </tr>
            ))}
            {report.byService.length === 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-center text-neutral-400">
                  ไม่มีข้อมูลในช่วงเวลานี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">ยอดขายและค่ามือตามหมอนวด</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="pb-1">หมอนวด</th>
              <th className="pb-1 text-right">จำนวน</th>
              <th className="pb-1 text-right">ยอดขาย</th>
              <th className="pb-1 text-right">ค่ามือ</th>
            </tr>
          </thead>
          <tbody>
            {report.byTherapist.map((row) => (
              <tr key={row.therapistId} className="border-t border-neutral-100">
                <td className="py-1">{row.nickname}</td>
                <td className="py-1 text-right">{row.quantity}</td>
                <td className="py-1 text-right">฿{NUMBER_FORMAT.format(row.revenue)}</td>
                <td className="py-1 text-right">฿{NUMBER_FORMAT.format(row.commission)}</td>
              </tr>
            ))}
            {report.byTherapist.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-center text-neutral-400">
                  ไม่มีข้อมูลในช่วงเวลานี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">ยอดขายรายวัน</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="pb-1">วันที่</th>
              <th className="pb-1 text-right">จำนวนบิล</th>
              <th className="pb-1 text-right">ยอดขาย</th>
            </tr>
          </thead>
          <tbody>
            {report.byDay.map((row) => (
              <tr key={row.date} className="border-t border-neutral-100">
                <td className="py-1">{DAY_FORMAT.format(new Date(row.date))}</td>
                <td className="py-1 text-right">{row.transactionCount}</td>
                <td className="py-1 text-right">฿{NUMBER_FORMAT.format(row.revenue)}</td>
              </tr>
            ))}
            {report.byDay.length === 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-center text-neutral-400">
                  ไม่มีข้อมูลในช่วงเวลานี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
