import { cn } from "@/lib/cn";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: "border-primary/20 bg-primary-light text-primary",
  success: "border-success/20 bg-success-light text-success-hover",
  warning: "border-warning/20 bg-warning-light text-warning-hover",
  danger: "border-danger/20 bg-danger-light text-danger-hover",
};

const ICONS: Record<AlertVariant, React.ReactNode> = {
  info: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  ),
  success: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  warning: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  ),
  danger: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />,
};

export function Alert({
  variant = "info",
  title,
  className,
  children,
}: {
  variant?: AlertVariant;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "flex animate-slide-up items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      <svg className="mt-0.5 h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" fill="none" aria-hidden="true">
        {ICONS[variant]}
      </svg>
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5 opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}
