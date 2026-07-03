import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp-webhook-auth";

const originalSecret = process.env.WA_APP_SECRET;

beforeEach(() => {
  process.env.WA_APP_SECRET = "test-app-secret";
});

afterEach(() => {
  process.env.WA_APP_SECRET = originalSecret;
});

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyWhatsAppWebhookSignature", () => {
  it("accepts a signature computed the way Meta computes it", () => {
    const body = JSON.stringify({ entry: [] });
    expect(verifyWhatsAppWebhookSignature(body, sign(body, "test-app-secret"))).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const body = JSON.stringify({ entry: [] });
    expect(verifyWhatsAppWebhookSignature(body, sign(body, "wrong-secret"))).toBe(false);
  });

  it("rejects when the body has been tampered with after signing", () => {
    const signed = sign(JSON.stringify({ entry: [] }), "test-app-secret");
    expect(verifyWhatsAppWebhookSignature(JSON.stringify({ entry: [{ tampered: true }] }), signed)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyWhatsAppWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects a signature missing the sha256= prefix", () => {
    const body = "{}";
    const hex = createHmac("sha256", "test-app-secret").update(body).digest("hex");
    expect(verifyWhatsAppWebhookSignature(body, hex)).toBe(false);
  });

  it("rejects when WA_APP_SECRET isn't configured", () => {
    delete process.env.WA_APP_SECRET;
    const body = "{}";
    expect(verifyWhatsAppWebhookSignature(body, sign(body, "test-app-secret"))).toBe(false);
  });
});
