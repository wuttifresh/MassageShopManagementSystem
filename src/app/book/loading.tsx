import { Skeleton } from "@/components/ui/skeleton";

export default function BookLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4 sm:p-6">
      <Skeleton className="h-7 w-32" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </main>
  );
}
