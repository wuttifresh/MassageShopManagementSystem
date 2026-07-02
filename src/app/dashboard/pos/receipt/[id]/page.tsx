import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PrintButton } from "./print-button";
import { BackLink } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอนเงิน",
  PROMPTPAY: "พร้อมเพย์",
  CARD: "บัตร",
};

const STATUS_LABEL: Record<string, string> = {
  PAID: "ชำระแล้ว",
  VOIDED: "ยกเลิกแล้ว",
  REFUNDED: "คืนเงินแล้ว",
  PENDING: "รอชำระ",
};

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect(`/login?callbackUrl=/dashboard/pos/receipt/${params.id}`);
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      branch: true,
      cashier: true,
      items: { include: { serviceOption: { include: { service: true } }, therapist: true } },
    },
  });
  if (!transaction || transaction.deletedAt) notFound();
  if (session.user.role === "STAFF" && session.user.branchId !== transaction.branchId) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <BackLink href="/dashboard/pos" />
        <PrintButton />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-sm shadow-card print:border-none print:shadow-none">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{transaction.branch.name}</p>
          {transaction.branch.address && <p className="text-text-secondary">{transaction.branch.address}</p>}
        </div>

        <div className="flex justify-between border-t border-dashed border-border pt-3">
          <span className="text-text-secondary">เลขที่ใบเสร็จ</span>
          <span className="font-medium text-gray-900">{transaction.receiptNo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">วันที่</span>
          <span className="text-gray-900">{DATE_FORMAT.format(transaction.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">แคชเชียร์</span>
          <span className="text-gray-900">{transaction.cashier.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">สถานะ</span>
          <Badge variant={transaction.status === "PAID" ? "success" : transaction.status === "VOIDED" ? "danger" : "neutral"}>
            {STATUS_LABEL[transaction.status] ?? transaction.status}
          </Badge>
        </div>

        <div className="flex flex-col gap-2 border-t border-dashed border-border pt-3">
          {transaction.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-900">
                  {item.serviceOption.service.name} ({item.serviceOption.durationMinutes} นาที)
                  {item.quantity > 1 ? ` x${item.quantity}` : ""}
                </p>
                <p className="text-xs text-text-secondary">หมอนวด: {item.therapist?.nickname ?? "-"}</p>
              </div>
              <span className="shrink-0 text-gray-900">฿{item.lineTotal.toString()}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t border-dashed border-border pt-3">
          <div className="flex justify-between">
            <span className="text-text-secondary">ยอดรวม</span>
            <span className="text-gray-900">฿{transaction.subtotal.toString()}</span>
          </div>
          {Number(transaction.discountAmount) > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">ส่วนลด</span>
              <span className="text-gray-900">-฿{transaction.discountAmount.toString()}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-gray-400">
            <span>ในนี้รวม VAT {transaction.vatRate.toString()}%</span>
            <span>฿{transaction.vatAmount.toString()}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-gray-900">
            <span>ยอดสุทธิ</span>
            <span>฿{transaction.totalAmount.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">ชำระโดย</span>
            <span className="text-gray-900">{PAYMENT_LABEL[transaction.paymentMethod] ?? transaction.paymentMethod}</span>
          </div>
        </div>

        {transaction.status === "VOIDED" && (
          <p className="border-t border-dashed border-border pt-3 text-danger">
            ยกเลิกแล้ว: {transaction.voidReason}
          </p>
        )}
      </div>
    </div>
  );
}
