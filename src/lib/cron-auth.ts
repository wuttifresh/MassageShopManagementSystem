import { NextRequest } from "next/server";

/// Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when an env var named
/// exactly `CRON_SECRET` is set on the project — this checks that header on every cron route so
/// the endpoint can't be triggered by anyone who finds the URL. The external GitHub Actions
/// workflow that drives the reminder cron (Vercel Hobby only allows daily crons) sends the same
/// header using the secret stored as a repo secret.
///
/// If `CRON_SECRET` isn't set at all (local dev), the check is skipped so `curl localhost:3000/...`
/// keeps working without extra setup — this must never be the case in production.
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
