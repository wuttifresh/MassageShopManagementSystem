import { describe, expect, it, beforeEach, vi } from "vitest";
import { checkRateLimit, __resetRateLimitsForTests } from "@/lib/rate-limit";

beforeEach(() => {
  __resetRateLimitsForTests();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("user:abc", 3, 60_000)).toEqual({ allowed: true });
    }
  });

  it("blocks the request once the limit is exceeded", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("user:abc", 3, 60_000);

    const result = checkRateLimit("user:abc", 3, 60_000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate identities independently", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("user:abc", 3, 60_000);

    // A different identity should be unaffected by "user:abc" being exhausted.
    expect(checkRateLimit("user:xyz", 3, 60_000)).toEqual({ allowed: true });
  });

  it("resets the count once the window has elapsed", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 3; i++) checkRateLimit("user:abc", 3, 60_000);
      expect(checkRateLimit("user:abc", 3, 60_000).allowed).toBe(false);

      vi.advanceTimersByTime(60_001);

      expect(checkRateLimit("user:abc", 3, 60_000)).toEqual({ allowed: true });
    } finally {
      vi.useRealTimers();
    }
  });
});
