import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { BookingWizard } from "./booking-wizard";

export default async function BookPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.role !== "CUSTOMER") {
    redirect("/login?callbackUrl=/book");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">จองคิวนวด</h1>
      <BookingWizard />
    </main>
  );
}
