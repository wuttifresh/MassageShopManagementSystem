import { NextResponse } from "next/server";
import { getAnyTherapistSlots, getTherapistSlots } from "@/lib/availability";

function formatTime(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const serviceId = searchParams.get("serviceId");
  const therapistId = searchParams.get("therapistId"); // omitted/empty = "any therapist"
  const dateParam = searchParams.get("date"); // YYYY-MM-DD
  const durationMinutes = Number(searchParams.get("durationMinutes"));

  if (!branchId || !serviceId || !dateParam || !durationMinutes) {
    return NextResponse.json(
      { error: "ต้องระบุ branchId, serviceId, date และ durationMinutes" },
      { status: 400 }
    );
  }

  const date = new Date(dateParam);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
  }

  const slots = therapistId
    ? await getTherapistSlots(therapistId, date, durationMinutes)
    : await getAnyTherapistSlots(branchId, serviceId, date, durationMinutes);

  return NextResponse.json({ slots: slots.map(formatTime) });
}
