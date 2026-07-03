/// Simple in-memory, per-identity fixed-window rate limiter.
///
/// Deliberately not backed by Redis/Upstash for now (see
/// multi-channel-booking-prompt.md checkpoint notes) — this project has no rate-limiting
/// pattern to extend, and adding an external service was judged more than this needs right now.
/// The known tradeoff: state lives in this module's memory, so it does *not* share counts across
/// concurrent Vercel serverless instances/regions — a determined attacker spreading requests
/// across cold starts can exceed the nominal limit. Acceptable for now because booking creation
/// is still gated by the DB-level EXCLUDE constraint and per-identity LINE/session verification;
/// this is a courtesy throttle against accidental retry storms, not the only line of defense.
/// If this needs to be airtight later, swap the Map below for an Upstash Redis counter — the
/// call site (checkRateLimit) doesn't need to change shape.
const buckets = new Map<string, { count: number; resetAt: number }>();

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true };
}

/// Test-only escape hatch — production code never needs to clear the map.
export function __resetRateLimitsForTests(): void {
  buckets.clear();
}
