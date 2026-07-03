import { describe, expect, it, vi } from "vitest";
import { signPayload, verifyPayload } from "@/lib/whatsapp-flow-token";

describe("whatsapp-flow-token", () => {
  it("verifies a token it signed itself", () => {
    const token = signPayload({ waId: "66812345678" }, "secret", 60_000);
    expect(verifyPayload<{ waId: string }>(token, "secret")?.waId).toBe("66812345678");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signPayload({ waId: "66812345678" }, "secret-a", 60_000);
    expect(verifyPayload(token, "secret-b")).toBeNull();
  });

  it("rejects a tampered payload even though the signature still parses as base64url", () => {
    const token = signPayload({ waId: "66812345678" }, "secret", 60_000);
    const [encoded, signature] = token.split(".");
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    decoded.waId = "00000000000";
    const tamperedEncoded = Buffer.from(JSON.stringify(decoded)).toString("base64url");

    expect(verifyPayload(`${tamperedEncoded}.${signature}`, "secret")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    try {
      const token = signPayload({ waId: "66812345678" }, "secret", 1000);
      vi.advanceTimersByTime(1001);
      expect(verifyPayload(token, "secret")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects malformed tokens", () => {
    expect(verifyPayload("not-a-valid-token", "secret")).toBeNull();
    expect(verifyPayload("", "secret")).toBeNull();
    expect(verifyPayload("a.b.c", "secret")).toBeNull();
  });
});
