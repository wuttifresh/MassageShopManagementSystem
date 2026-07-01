import { NextResponse } from "next/server";
import { getEligibleTherapists } from "@/lib/availability";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const serviceId = searchParams.get("serviceId");

  if (!branchId || !serviceId) {
    return NextResponse.json({ error: "ต้องระบุ branchId และ serviceId" }, { status: 400 });
  }

  const therapists = await getEligibleTherapists(branchId, serviceId);

  return NextResponse.json({
    therapists: therapists.map((t) => ({
      id: t.id,
      nickname: t.nickname,
      bio: t.bio,
      ratingAverage: t.ratingAverage,
    })),
  });
}
