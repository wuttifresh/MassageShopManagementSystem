import { cn } from "@/lib/cn";

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-gray-50/60 px-4 py-10 text-center",
        className
      )}
    >
      <div className="text-3xl" aria-hidden="true">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
