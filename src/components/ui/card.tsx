import { cn } from "@/lib/cn";

export function Card({
  className,
  padded = true,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-card",
        padded && "p-4 sm:p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function ListRow({
  className,
  interactive = true,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 text-sm transition-all duration-150 sm:p-4",
        interactive && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
