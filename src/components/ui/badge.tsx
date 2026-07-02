import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-gray-100 text-gray-600",
  primary: "bg-primary-light text-primary",
  success: "bg-success-light text-success-hover",
  warning: "bg-warning-light text-warning-hover",
  danger: "bg-danger-light text-danger-hover",
  info: "bg-accent-light text-accent-hover",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
