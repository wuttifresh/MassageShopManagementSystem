import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentSession } from "@/lib/session";
import { getSalesReport } from "@/lib/reports";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!branchId || !startDate || !endDate) {
    return NextResponse.json({ error: "พารามิเตอร์ไม่ครบ" }, { status: 400 });
  }
  if (session.user.role === "STAFF" && session.user.branchId !== branchId) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงสาขานี้" }, { status: 403 });
  }

  const report = await getSalesReport({
    branchId,
    startDate: new Date(startDate),
    endDate: new Date(new Date(endDate).getTime() + 86_400_000),
  });

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      { รายการ: "ยอดขายรวม", จำนวนเงิน: report.summary.totalRevenue },
      { รายการ: "จำนวนบิล", จำนวนเงิน: report.summary.transactionCount },
      { รายการ: "VAT รวม", จำนวนเงิน: report.summary.totalVat },
      { รายการ: "ค่ามือรวม", จำนวนเงิน: report.summary.totalCommission },
    ]),
    "สรุป"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.byService.map((r) => ({ บริการ: r.serviceName, จำนวน: r.quantity, ยอดขาย: r.revenue }))
    ),
    "ตามบริการ"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.byTherapist.map((r) => ({
        หมอนวด: r.nickname,
        จำนวน: r.quantity,
        ยอดขาย: r.revenue,
        ค่ามือ: r.commission,
      }))
    ),
    "ตามหมอนวด"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.byDay.map((r) => ({ วันที่: r.date, จำนวนบิล: r.transactionCount, ยอดขาย: r.revenue }))
    ),
    "รายวัน"
  );

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sales-report-${startDate}-to-${endDate}.xlsx"`,
    },
  });
}
