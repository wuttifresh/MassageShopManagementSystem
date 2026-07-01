export default function TherapistLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <div className="h-6 w-32 animate-pulse rounded bg-neutral-200" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-200" />
        ))}
      </div>
    </main>
  );
}
