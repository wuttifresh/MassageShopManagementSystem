import { prisma } from "@/lib/prisma";

export type ServiceSalesRow = { serviceId: string; serviceName: string; quantity: number; revenue: number };
export type TherapistSalesRow = {
  therapistId: string;
  nickname: string;
  quantity: number;
  revenue: number;
  commission: number;
};
export type DailySalesRow = { date: string; revenue: number; transactionCount: number };

export type SalesReport = {
  summary: {
    totalRevenue: number;
    transactionCount: number;
    totalVat: number;
    totalCommission: number;
  };
  byService: ServiceSalesRow[];
  byTherapist: TherapistSalesRow[];
  byDay: DailySalesRow[];
};

/// All PAID transactions in [startDate, endDate) for a branch, aggregated three ways. Fetches
/// once and reduces in JS rather than several separate groupBy queries — simple, and plenty fast
/// for the transaction volume a single-branch massage shop produces in a reporting window.
export async function getSalesReport({
  branchId,
  startDate,
  endDate,
}: {
  branchId: string;
  startDate: Date;
  endDate: Date;
}): Promise<SalesReport> {
  const transactions = await prisma.transaction.findMany({
    where: { branchId, status: "PAID", deletedAt: null, createdAt: { gte: startDate, lt: endDate } },
    include: {
      items: { include: { serviceOption: { include: { service: true } }, therapist: true } },
    },
  });

  let totalRevenue = 0;
  let totalVat = 0;
  let totalCommission = 0;
  const byServiceMap = new Map<string, ServiceSalesRow>();
  const byTherapistMap = new Map<string, TherapistSalesRow>();
  const byDayMap = new Map<string, DailySalesRow>();

  for (const tx of transactions) {
    totalRevenue += Number(tx.totalAmount);
    totalVat += Number(tx.vatAmount);

    const dayKey = tx.createdAt.toISOString().slice(0, 10);
    const dayRow = byDayMap.get(dayKey) ?? { date: dayKey, revenue: 0, transactionCount: 0 };
    dayRow.revenue += Number(tx.totalAmount);
    dayRow.transactionCount += 1;
    byDayMap.set(dayKey, dayRow);

    for (const item of tx.items) {
      totalCommission += Number(item.commissionAmount);

      const serviceId = item.serviceOption.serviceId;
      const svcRow = byServiceMap.get(serviceId) ?? {
        serviceId,
        serviceName: item.serviceOption.service.name,
        quantity: 0,
        revenue: 0,
      };
      svcRow.quantity += item.quantity;
      svcRow.revenue += Number(item.lineTotal);
      byServiceMap.set(serviceId, svcRow);

      if (item.therapistId) {
        const thRow = byTherapistMap.get(item.therapistId) ?? {
          therapistId: item.therapistId,
          nickname: item.therapist?.nickname ?? "-",
          quantity: 0,
          revenue: 0,
          commission: 0,
        };
        thRow.quantity += item.quantity;
        thRow.revenue += Number(item.lineTotal);
        thRow.commission += Number(item.commissionAmount);
        byTherapistMap.set(item.therapistId, thRow);
      }
    }
  }

  return {
    summary: { totalRevenue, transactionCount: transactions.length, totalVat, totalCommission },
    byService: Array.from(byServiceMap.values()).sort((a, b) => b.revenue - a.revenue),
    byTherapist: Array.from(byTherapistMap.values()).sort((a, b) => b.revenue - a.revenue),
    byDay: Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
