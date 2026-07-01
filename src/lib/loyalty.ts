import type { Prisma } from "@/generated/prisma/client";

/// 1 point per 25 THB actually paid (cash-equivalent — package-redeemed lines contribute 0 since
/// the customer already paid when they bought the package). Simple flat ratio; no tier-based
/// multipliers yet since automatic tier upgrades weren't asked for in Phase 7.
const BAHT_PER_POINT = 25;

export function calculatePointsEarned(amountPaid: number): number {
  return Math.floor(amountPaid / BAHT_PER_POINT);
}

/// Awards points to a customer's Membership, creating it if this is their first-ever purchase.
/// Must be called inside the same $transaction as the Transaction/TransactionItem writes.
export async function awardPoints(
  tx: Prisma.TransactionClient,
  customerId: string,
  points: number
): Promise<void> {
  if (points <= 0) return;

  await tx.membership.upsert({
    where: { customerId },
    update: { points: { increment: points } },
    create: { customerId, points },
  });
}

/// Reverses previously-awarded points (e.g. when a transaction is voided). Never lets a
/// customer's balance go negative from a reversal alone.
export async function reversePoints(
  tx: Prisma.TransactionClient,
  customerId: string,
  points: number
): Promise<void> {
  if (points <= 0) return;

  const membership = await tx.membership.findUnique({ where: { customerId } });
  if (!membership) return;

  await tx.membership.update({
    where: { customerId },
    data: { points: Math.max(0, membership.points - points) },
  });
}
