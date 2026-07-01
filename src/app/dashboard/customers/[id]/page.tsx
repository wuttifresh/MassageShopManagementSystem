import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาตามนัด",
  COMPLETED: "เสร็จสิ้น",
  RESCHEDULED: "เลื่อนนัดแล้ว",
};

const PACKAGE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "ใช้งานได้",
  EXPIRED: "หมดอายุ",
  FULLY_USED: "ใช้ครบแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "UTC" });

export default async function CustomerProfilePage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect(`/login?callbackUrl=/dashboard/customers/${params.id}`);
  }

  const customer = await prisma.user.findUnique({
    where: { id: params.id, role: "CUSTOMER" },
    include: { membership: true },
  });
  if (!customer || customer.deletedAt) notFound();

  const [packages, bookings, transactions] = await Promise.all([
    prisma.package.findMany({
      where: { customerId: customer.id, deletedAt: null },
      include: { service: true },
      orderBy: { purchasedAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { customerId: customer.id, deletedAt: null },
      include: { serviceOption: { include: { service: true } }, therapist: true },
      orderBy: { startTime: "desc" },
      take: 10,
    }),
    prisma.transaction.findMany({
      where: { queue: { customerId: customer.id }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4">
      <Link href="/dashboard/customers" className="text-sm text-neutral-400">
        ← กลับ
      </Link>

      <header>
        <h1 className="text-xl font-semibold">{customer.name}</h1>
        <p className="text-sm text-neutral-500">
          {customer.phone ?? "ไม่มีเบอร์โทร"} ·{" "}
          {customer.membership
            ? `${customer.membership.tier} · ${customer.membership.points} แต้ม`
            : "ยังไม่ใช่สมาชิก"}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">คอร์ส/แพ็กเกจ</h2>
          <Link
            href={`/dashboard/customers/${customer.id}/packages/new`}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            + ขายคอร์สใหม่
          </Link>
        </div>
        {packages.length === 0 && <p className="text-sm text-neutral-400">ยังไม่มีคอร์ส</p>}
        {packages.map((pkg) => (
          <div key={pkg.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm">
            <div>
              <p className="font-medium">{pkg.name}</p>
              <p className="text-neutral-500">
                เหลือ {pkg.remainingSessions}/{pkg.totalSessions} ครั้ง
                {pkg.service ? ` · ${pkg.service.name}` : " · ใช้ได้ทุกบริการ"}
                {pkg.expiresAt ? ` · หมดอายุ ${DATE_FORMAT.format(pkg.expiresAt)}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
              {PACKAGE_STATUS_LABEL[pkg.status] ?? pkg.status}
            </span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">ประวัติการจอง</h2>
        {bookings.length === 0 && <p className="text-sm text-neutral-400">ยังไม่มีประวัติการจอง</p>}
        {bookings.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm">
            <div>
              <p className="font-medium">{b.serviceOption.service.name}</p>
              <p className="text-neutral-500">
                {DATE_FORMAT.format(b.startTime)} · หมอนวด {b.therapist?.nickname ?? "-"}
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
              {BOOKING_STATUS_LABEL[b.status] ?? b.status}
            </span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">ประวัติการชำระเงิน</h2>
        {transactions.length === 0 && <p className="text-sm text-neutral-400">ยังไม่มีประวัติการชำระเงิน</p>}
        {transactions.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/pos/receipt/${t.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm hover:border-neutral-900"
          >
            <span>{t.receiptNo}</span>
            <span>฿{t.totalAmount.toString()}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
