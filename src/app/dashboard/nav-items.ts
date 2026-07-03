import type { Dictionary } from "@/i18n/get-dictionary";

export type NavItem = {
  href: string;
  labelKey: keyof Dictionary["nav"];
  icon: string;
  ownerOnly?: boolean;
};

/// Shared nav config for the dashboard sidebar/drawer. `icon` keys into the path map in
/// nav-icon.tsx, and `labelKey` looks up dict.nav[labelKey] — kept as plain data here so it can
/// be reused by both desktop and mobile nav.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: "home" },
  { href: "/dashboard/pos", labelKey: "pos", icon: "pos" },
  { href: "/dashboard/bookings", labelKey: "bookings", icon: "calendar" },
  { href: "/dashboard/customers", labelKey: "customers", icon: "users" },
  { href: "/dashboard/therapists", labelKey: "therapists", icon: "sparkles" },
  { href: "/dashboard/services", labelKey: "services", icon: "tag" },
  { href: "/dashboard/reports", labelKey: "reports", icon: "chart" },
  { href: "/dashboard/branches", labelKey: "branches", icon: "building", ownerOnly: true },
  { href: "/dashboard/staff", labelKey: "staff", icon: "id", ownerOnly: true },
];
