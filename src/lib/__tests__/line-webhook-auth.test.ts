import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyLineWebhookSignature } from "@/lib/line-webhook-auth";

const originalSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET;

beforeEach(() => {
  process.env.LINE_MESSAGING_CHANNEL_SECRET = "test-channel-secret";
});

afterEach(() => {
  process.env.LINE_MESSAGING_CHANNEL_SECRET = originalSecret;
});

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

describe("verifyLineWebhookSignature", () => {
  it("accepts a signature computed the way LINE computes it", () => {
    const body = JSON.stringify({ events: [] });
    expect(verifyLineWebhookSignature(body, sign(body, "test-channel-secret"))).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const body = JSON.stringify({ events: [] });
    expect(verifyLineWebhookSignature(body, sign(body, "wrong-secret"))).toBe(false);
  });

  it("rejects when the body has been tampered with after signing", () => {
    const signed = sign(JSON.stringify({ events: [] }), "test-channel-secret");
    expect(verifyLineWebhookSignature(JSON.stringify({ events: [{ tampered: true }] }), signed)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyLineWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects when LINE_MESSAGING_CHANNEL_SECRET isn't configured", () => {
    delete process.env.LINE_MESSAGING_CHANNEL_SECRET;
    const body = "{}";
    expect(verifyLineWebhookSignature(body, sign(body, "test-channel-secret"))).toBe(false);
  });
});
