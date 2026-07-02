export type NavItem = {
  href: string;
  label: string;
  icon: string;
  ownerOnly?: boolean;
};

/// Shared nav config for the dashboard sidebar/drawer. `icon` keys into the path map in
/// nav-icon.tsx — kept as plain data here so it can be reused by both desktop and mobile nav.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "แดชบอร์ดคิว", icon: "home" },
  { href: "/dashboard/pos", label: "POS / ชำระเงิน", icon: "pos" },
  { href: "/dashboard/customers", label: "ลูกค้า", icon: "users" },
  { href: "/dashboard/therapists", label: "จัดการหมอนวด", icon: "sparkles" },
  { href: "/dashboard/services", label: "จัดการบริการ", icon: "tag" },
  { href: "/dashboard/reports", label: "รายงาน", icon: "chart" },
  { href: "/dashboard/branches", label: "จัดการสาขา", icon: "building", ownerOnly: true },
  { href: "/dashboard/staff", label: "พนักงาน", icon: "id", ownerOnly: true },
];
