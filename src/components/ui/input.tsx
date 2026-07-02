import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const CONTROL_CLASSES =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

const INVALID_CLASSES = "border-danger focus:border-danger focus:ring-danger/10";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(CONTROL_CLASSES, invalid && INVALID_CLASSES, className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(CONTROL_CLASSES, "min-h-[96px] resize-y", invalid && INVALID_CLASSES, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

// Encoded inline rather than as a Tailwind background-image arbitrary-value class: the raw SVG
// contains spaces, and Tailwind's arbitrary-value parser splits on unescaped whitespace, which
// would silently break the class. A plain `style` background avoids that entirely.
const SELECT_ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236B7280'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z' clip-rule='evenodd'/%3E%3C/svg%3E\")";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, style, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(CONTROL_CLASSES, "appearance-none bg-no-repeat pr-9", invalid && INVALID_CLASSES, className)}
      style={{ backgroundImage: SELECT_ARROW, backgroundPosition: "right 0.65rem center", backgroundSize: "1.1rem", ...style }}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
});
