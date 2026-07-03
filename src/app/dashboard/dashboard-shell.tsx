"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/i18n/locale-provider";
import { NAV_ITEMS } from "./nav-items";
import { NavIcon } from "./nav-icon";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function NavLinks({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { dict } = useTranslation();
  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || role === "OWNER");

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin px-3 py-4">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary-light text-primary"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
            {dict.nav[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  const { dict } = useTranslation();
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-soft">
        <NavIcon name="sparkles" className="h-5 w-5" />
      </div>
      <span className="text-sm font-semibold text-gray-900">{dict.brand.name}</span>
    </div>
  );
}

export function DashboardShell({
  user,
  languageSwitcher,
  children,
}: {
  user: { name: string; role: string };
  languageSwitcher: React.ReactNode;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { dict, locale } = useTranslation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const roleLabel = user.role === "OWNER" ? dict.role.OWNER : dict.role.STAFF;
  const dateFormat = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-card xl:w-72">
        <Brand />
        <NavLinks role={user.role} />
      </aside>

      {/* Tablet collapsible rail: icons only, expands to drawer on tap */}
      <aside className="hidden md:flex md:w-[72px] md:shrink-0 md:flex-col md:border-r md:border-border md:bg-card lg:hidden">
        <div className="flex h-16 items-center justify-center border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-soft">
            <NavIcon name="sparkles" className="h-5 w-5" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center gap-3 border-b border-border px-3 py-3 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label={dict.common.openMenu}
        >
          <NavIcon name="menu" className="h-5 w-5" />
        </button>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto scrollbar-thin py-3">
          {NAV_ITEMS.filter((item) => !item.ownerOnly || user.role === "OWNER").map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={dict.nav[item.labelKey]}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                  active ? "bg-primary-light text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <NavIcon name={item.icon} className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-gray-900/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex h-full w-72 max-w-[80vw] animate-drawer-in flex-col bg-card shadow-dropdown">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={dict.common.closeMenu}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <NavIcon name="close" className="h-5 w-5" />
              </button>
            </div>
            <NavLinks role={user.role} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label={dict.common.openMenu}
          >
            <NavIcon name="menu" className="h-[22px] w-[22px]" />
          </button>

          <span className="hidden text-sm font-medium text-gray-500 md:block">{dateFormat.format(new Date())}</span>

          <div className="flex flex-1 items-center justify-end gap-3">
          {languageSwitcher}
          <DropdownMenu
            align="end"
            trigger={({ open }) => (
              <span
                className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-100 ${
                  open ? "bg-gray-100" : ""
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-tight text-gray-900">{user.name}</span>
                  <span className="block text-xs leading-tight text-text-secondary">
                    {roleLabel}
                  </span>
                </span>
                <NavIcon name="chevronDown" className="hidden h-4 w-4 text-gray-400 sm:block" />
              </span>
            )}
          >
            <div className="border-b border-border px-3 py-2 sm:hidden">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-text-secondary">{roleLabel}</p>
            </div>
            <div className="p-1">
              <DropdownItem
                className="text-danger hover:bg-danger-light"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <NavIcon name="logout" className="h-4 w-4" />
                {dict.common.signOut}
              </DropdownItem>
            </div>
          </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export { DropdownItem };
