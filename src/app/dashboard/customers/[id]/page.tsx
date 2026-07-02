import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, ListRow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";

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
    <div className="flex flex-col gap-5">
      <PageHeader
        backHref="/dashboard/customers"
        title={customer.name}
        description={`${customer.phone ?? "ไม่มีเบอร์โทร"} · ${
          customer.membership
            ? `${customer.membership.tier} · ${customer.membership.points} แต้ม`
            : "ยังไม่ใช่สมาชิก"
        }`}
      />

      <Card>
        <CardHeader
          title="คอร์ส/แพ็กเกจ"
          action={<LinkButton size="sm" href={`/dashboard/customers/${customer.id}/packages/new`}>+ ขายคอร์สใหม่</LinkButton>}
        />
        {packages.length === 0 ? (
          <EmptyState icon="🎫" title="ยังไม่มีคอร์ส" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {packages.map((pkg) => (
              <ListRow key={pkg.id} interactive={false}>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{pkg.name}</p>
                  <p className="truncate text-text-secondary">
                    เหลือ {pkg.remainingSessions}/{pkg.totalSessions} ครั้ง
                    {pkg.service ? ` · ${pkg.service.name}` : " · ใช้ได้ทุกบริการ"}
                    {pkg.expiresAt ? ` · หมดอายุ ${DATE_FORMAT.format(pkg.expiresAt)}` : ""}
                  </p>
                </div>
                <Badge>{PACKAGE_STATUS_LABEL[pkg.status] ?? pkg.status}</Badge>
              </ListRow>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="ประวัติการจอง" />
        {bookings.length === 0 ? (
          <EmptyState icon="🗓️" title="ยังไม่มีประวัติการจอง" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {bookings.map((b) => (
              <ListRow key={b.id} interactive={false}>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{b.serviceOption.service.name}</p>
                  <p className="truncate text-text-secondary">
                    {DATE_FORMAT.format(b.startTime)} · หมอนวด {b.therapist?.nickname ?? "-"}
                  </p>
                </div>
                <Badge>{BOOKING_STATUS_LABEL[b.status] ?? b.status}</Badge>
              </ListRow>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="ประวัติการชำระเงิน" />
        {transactions.length === 0 ? (
          <EmptyState icon="🧾" title="ยังไม่มีประวัติการชำระเงิน" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {transactions.map((t) => (
              <Link key={t.id} href={`/dashboard/pos/receipt/${t.id}`}>
                <ListRow>
                  <span className="font-medium text-gray-900">{t.receiptNo}</span>
                  <span className="text-gray-900">฿{t.totalAmount.toString()}</span>
                </ListRow>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
