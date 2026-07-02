import { cn } from "@/lib/cn";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  cell: (row: T) => React.ReactNode;
  emphasize?: boolean;
};

/// Renders a real <table> with a sticky header and zebra rows on tablet/desktop, and switches to
/// a stacked label/value card per row on mobile — same data, no duplicated markup per page.
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "ไม่มีข้อมูล",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <>
      {/* Desktop / tablet: real table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "border-b border-border px-3.5 py-2.5 font-medium text-text-secondary",
                    col.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="odd:bg-white even:bg-gray-50/60 hover:bg-primary-light/40">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3.5 py-2.5 text-gray-900",
                      col.align === "right" ? "text-right" : "text-left",
                      col.emphasize && "font-medium"
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-xl border border-border bg-card p-3.5 text-sm">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center justify-between gap-3 py-0.5">
                <span className="text-text-secondary">{col.header}</span>
                <span className={cn("text-gray-900", col.emphasize && "font-medium")}>{col.cell(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
