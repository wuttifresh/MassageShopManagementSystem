import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendWhatsAppFlowMessage, sendWhatsAppTemplateMessage, sendWhatsAppTextMessage } from "@/lib/whatsapp-messaging";

const originalFetch = global.fetch;
const originalToken = process.env.WA_MESSAGING_ACCESS_TOKEN;
const originalPhoneId = process.env.WA_PHONE_NUMBER_ID;

beforeEach(() => {
  process.env.WA_MESSAGING_ACCESS_TOKEN = "test-token";
  process.env.WA_PHONE_NUMBER_ID = "1234567890";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.WA_MESSAGING_ACCESS_TOKEN = originalToken;
  process.env.WA_PHONE_NUMBER_ID = originalPhoneId;
});

describe("sendWhatsAppTextMessage", () => {
  it("posts a text message to the Cloud API and reports success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

    const result = await sendWhatsAppTextMessage("66812345678", "สวัสดีค่ะ");

    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v20.0/1234567890/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "66812345678",
      type: "text",
      text: { body: "สวัสดีค่ะ" },
    });
  });

  it("returns a failure result (never throws) on a non-2xx response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "bad request" }) as unknown as typeof fetch;

    const result = await sendWhatsAppTextMessage("66812345678", "text");
    expect(result.ok).toBe(false);
  });

  it("returns a failure result (never throws) when the network call itself fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await sendWhatsAppTextMessage("66812345678", "text");
    expect(result.ok).toBe(false);
  });

  it("returns a failure result without calling fetch when not configured", async () => {
    delete process.env.WA_MESSAGING_ACCESS_TOKEN;
    global.fetch = vi.fn();

    const result = await sendWhatsAppTextMessage("66812345678", "text");
    expect(result.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("sendWhatsAppTemplateMessage", () => {
  it("fills the template's body parameters in order", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

    await sendWhatsAppTemplateMessage("66812345678", "booking_reminder", "th", ["นวดไทย", "สาขาสยาม", "10:00"]);

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.template).toEqual({
      name: "booking_reminder",
      language: { code: "th" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: "นวดไทย" }, { type: "text", text: "สาขาสยาม" }, { type: "text", text: "10:00" }],
        },
      ],
    });
  });
});

describe("sendWhatsAppFlowMessage", () => {
  it("sends an interactive flow message carrying the signed flow_token", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

    await sendWhatsAppFlowMessage("66812345678", "flow-123", "signed-token-abc");

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.interactive.action.parameters).toMatchObject({
      flow_token: "signed-token-abc",
      flow_id: "flow-123",
    });
  });
});
