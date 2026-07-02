import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-card", className)}>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-gray-900 sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
    </div>
  );
}
