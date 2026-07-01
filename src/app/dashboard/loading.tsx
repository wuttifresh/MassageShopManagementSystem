export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <div className="h-6 w-40 animate-pulse rounded bg-neutral-200" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-200" />
        ))}
      </div>
    </main>
  );
}
