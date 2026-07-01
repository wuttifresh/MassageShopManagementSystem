import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export default async function ServicesPage() {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/services");
  }

  const services = await prisma.service.findMany({
    where: { deletedAt: null },
    include: { options: { orderBy: { durationMinutes: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-400">
            ← กลับแดชบอร์ด
          </Link>
          <h1 className="text-xl font-semibold">จัดการบริการ</h1>
        </div>
        <Link
          href="/dashboard/services/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          + เพิ่มบริการ
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {services.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/services/${s.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm hover:border-neutral-900"
          >
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-neutral-500">
                {s.options
                  .map((o) =>
                    o.promoPrice
                      ? `${o.durationMinutes}น. ฿${o.promoPrice} (ปกติ ฿${o.price})`
                      : `${o.durationMinutes}น. ฿${o.price}`
                  )
                  .join(" · ") || "ยังไม่มีตัวเลือกระยะเวลา"}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                s.isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {s.isActive ? "เปิดขาย" : "ปิดขาย"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
