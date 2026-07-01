import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { SearchForm } from "./search-form";

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getCurrentSession();
  if (!session?.user || (session.user.role !== "OWNER" && session.user.role !== "STAFF")) {
    redirect("/login?callbackUrl=/dashboard/customers");
  }

  const query = searchParams.q?.trim();

  const customers = query
    ? await prisma.user.findMany({
        where: {
          role: "CUSTOMER",
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { lineDisplayName: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { membership: true },
        take: 20,
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <Link href="/dashboard" className="text-sm text-neutral-400">
        ← กลับแดชบอร์ด
      </Link>
      <h1 className="text-xl font-semibold">ลูกค้า</h1>

      <SearchForm initialQuery={query ?? ""} />

      <div className="flex flex-col gap-2">
        {query && customers.length === 0 && (
          <p className="text-sm text-neutral-400">ไม่พบลูกค้าที่ตรงกับ &quot;{query}&quot;</p>
        )}
        {customers.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/customers/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm hover:border-neutral-900"
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-neutral-500">{c.phone ?? "ไม่มีเบอร์โทร"}</p>
            </div>
            {c.membership && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                {c.membership.tier} · {c.membership.points} แต้ม
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
