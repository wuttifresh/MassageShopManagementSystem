import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { resolveActiveBranchId } from "@/lib/branch-scope";
import { getSalesReport } from "@/lib/reports";
import { ReportFilterForm } from "./report-filter-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ResponsiveTable } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

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
    return <EmptyState icon="🏢" title="ยังไม่มีสาขาที่ใช้งานอยู่" className="mt-10" />;
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="รายงานยอดขาย"
        description="สรุปยอดขาย ค่ามือ และประสิทธิภาพตามช่วงเวลา"
        actions={
          <LinkButton href={exportUrl} variant="success">
            ส่งออก Excel
          </LinkButton>
        }
      />

      <Card>
        <ReportFilterForm
          branches={branches}
          activeBranchId={activeBranchId}
          startDate={startDate}
          endDate={endDate}
          showBranchPicker={session.user.role === "OWNER"}
        />
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="ยอดขายรวม" value={`฿${NUMBER_FORMAT.format(report.summary.totalRevenue)}`} />
        <StatCard label="จำนวนบิล" value={report.summary.transactionCount} />
        <StatCard label="VAT รวม" value={`฿${NUMBER_FORMAT.format(report.summary.totalVat)}`} />
        <StatCard label="ค่ามือรวม" value={`฿${NUMBER_FORMAT.format(report.summary.totalCommission)}`} />
      </section>

      <Card>
        <CardHeader title="ยอดขายตามบริการ" />
        <ResponsiveTable
          rowKey={(row) => row.serviceId}
          rows={report.byService}
          emptyMessage="ไม่มีข้อมูลในช่วงเวลานี้"
          columns={[
            { key: "name", header: "บริการ", cell: (row) => row.serviceName, emphasize: true },
            { key: "qty", header: "จำนวน", align: "right", cell: (row) => row.quantity },
            { key: "revenue", header: "ยอดขาย", align: "right", cell: (row) => `฿${NUMBER_FORMAT.format(row.revenue)}` },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="ยอดขายและค่ามือตามหมอนวด" />
        <ResponsiveTable
          rowKey={(row) => row.therapistId}
          rows={report.byTherapist}
          emptyMessage="ไม่มีข้อมูลในช่วงเวลานี้"
          columns={[
            { key: "name", header: "หมอนวด", cell: (row) => row.nickname, emphasize: true },
            { key: "qty", header: "จำนวน", align: "right", cell: (row) => row.quantity },
            { key: "revenue", header: "ยอดขาย", align: "right", cell: (row) => `฿${NUMBER_FORMAT.format(row.revenue)}` },
            { key: "commission", header: "ค่ามือ", align: "right", cell: (row) => `฿${NUMBER_FORMAT.format(row.commission)}` },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="ยอดขายรายวัน" />
        <ResponsiveTable
          rowKey={(row) => row.date}
          rows={report.byDay}
          emptyMessage="ไม่มีข้อมูลในช่วงเวลานี้"
          columns={[
            { key: "date", header: "วันที่", cell: (row) => DAY_FORMAT.format(new Date(row.date)), emphasize: true },
            { key: "count", header: "จำนวนบิล", align: "right", cell: (row) => row.transactionCount },
            { key: "revenue", header: "ยอดขาย", align: "right", cell: (row) => `฿${NUMBER_FORMAT.format(row.revenue)}` },
          ]}
        />
      </Card>
    </div>
  );
}
