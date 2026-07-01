import { CommissionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type CommissionSnapshot = {
  commissionType: CommissionType;
  commissionRate: number;
  commissionAmount: number;
};

/// Resolves what a therapist earns for one line item, at THIS moment — the result is meant to be
/// stored on TransactionItem as a snapshot (hard rule #4), never recomputed later from whatever
/// the therapist's rate happens to be by then.
export async function computeCommission(
  therapistId: string,
  serviceId: string,
  lineTotal: number,
  quantity: number
): Promise<CommissionSnapshot> {
  const therapist = await prisma.therapist.findUniqueOrThrow({ where: { id: therapistId } });

  const override = await prisma.therapistService.findUnique({
    where: { therapistId_serviceId: { therapistId, serviceId } },
  });

  const commissionType = therapist.commissionType;
  const commissionRate = Number(override?.commissionRateOverride ?? therapist.commissionRate);

  const commissionAmount =
    commissionType === CommissionType.PERCENTAGE
      ? Math.round(((lineTotal * commissionRate) / 100) * 100) / 100
      : Math.round(commissionRate * quantity * 100) / 100;

  return { commissionType, commissionRate, commissionAmount };
}
