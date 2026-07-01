import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PrintButton } from "./print-button";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard/pos" className="text-sm text-neutral-400">
          ← กลับ
        </Link>
        <PrintButton />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 p-4 text-sm print:border-none">
        <div className="text-center">
          <p className="text-lg font-semibold">{transaction.branch.name}</p>
          {transaction.branch.address && <p className="text-neutral-500">{transaction.branch.address}</p>}
        </div>

        <div className="flex justify-between border-t border-dashed border-neutral-300 pt-3">
          <span className="text-neutral-500">เลขที่ใบเสร็จ</span>
          <span className="font-medium">{transaction.receiptNo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">วันที่</span>
          <span>{DATE_FORMAT.format(transaction.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">แคชเชียร์</span>
          <span>{transaction.cashier.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">สถานะ</span>
          <span>{STATUS_LABEL[transaction.status] ?? transaction.status}</span>
        </div>

        <div className="flex flex-col gap-2 border-t border-dashed border-neutral-300 pt-3">
          {transaction.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <div>
                <p>
                  {item.serviceOption.service.name} ({item.serviceOption.durationMinutes} นาที)
                  {item.quantity > 1 ? ` x${item.quantity}` : ""}
                </p>
                <p className="text-xs text-neutral-500">หมอนวด: {item.therapist?.nickname ?? "-"}</p>
              </div>
              <span>฿{item.lineTotal.toString()}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t border-dashed border-neutral-300 pt-3">
          <div className="flex justify-between">
            <span className="text-neutral-500">ยอดรวม</span>
            <span>฿{transaction.subtotal.toString()}</span>
          </div>
          {Number(transaction.discountAmount) > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-500">ส่วนลด</span>
              <span>-฿{transaction.discountAmount.toString()}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-neutral-400">
            <span>ในนี้รวม VAT {transaction.vatRate.toString()}%</span>
            <span>฿{transaction.vatAmount.toString()}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>ยอดสุทธิ</span>
            <span>฿{transaction.totalAmount.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">ชำระโดย</span>
            <span>{PAYMENT_LABEL[transaction.paymentMethod] ?? transaction.paymentMethod}</span>
          </div>
        </div>

        {transaction.status === "VOIDED" && (
          <p className="border-t border-dashed border-neutral-300 pt-3 text-red-600">
            ยกเลิกแล้ว: {transaction.voidReason}
          </p>
        )}
      </div>
    </main>
  );
}
