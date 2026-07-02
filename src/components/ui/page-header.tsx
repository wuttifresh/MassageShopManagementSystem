import Link from "next/link";
import { cn } from "@/lib/cn";

export function BackLink({ href, label = "กลับ", className }: { href: string; label?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex w-fit items-center gap-1 text-sm font-medium text-text-secondary transition-colors hover:text-primary",
        className
      )}
    >
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
      </svg>
      {label}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {backHref && <BackLink href={backHref} label={backLabel} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
