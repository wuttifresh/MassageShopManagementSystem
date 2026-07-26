import { describe, expect, it, vi, beforeEach } from "vitest";

const { challengeCreate, challengeFindFirst, challengeUpdate, sendWhatsAppTemplateMessage } = vi.hoisted(() => ({
  challengeCreate: vi.fn(),
  challengeFindFirst: vi.fn(),
  challengeUpdate: vi.fn(),
  sendWhatsAppTemplateMessage: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    phoneOtpChallenge: {
      create: challengeCreate,
      findFirst: challengeFindFirst,
      update: challengeUpdate,
    },
  },
}));

vi.mock("@/lib/whatsapp-messaging", () => ({ sendWhatsAppTemplateMessage }));

import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/phone-otp";
import { createHash } from "node:crypto";

function hashOf(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  challengeCreate.mockReset();
  challengeFindFirst.mockReset();
  challengeUpdate.mockReset();
  sendWhatsAppTemplateMessage.mockReset();
  process.env = { ...ORIGINAL_ENV };
});

describe("requestPhoneOtp", () => {
  it("stores a hashed challenge and sends it via the configured WhatsApp template", async () => {
    process.env.WA_OTP_TEMPLATE_NAME = "otp_template";
    process.env.WA_OTP_TEMPLATE_LANG = "th";
    challengeCreate.mockResolvedValue({});
    sendWhatsAppTemplateMessage.mockResolvedValue({ ok: true });

    const result = await requestPhoneOtp("+66812345678");

    expect(result).toEqual({ ok: true });
    expect(challengeCreate).toHaveBeenCalledTimes(1);
    const data = challengeCreate.mock.calls[0][0].data;
    expect(data.phone).toBe("+66812345678");
    expect(data.codeHash).toHaveLength(64); // sha256 hex

    // Sent to Meta's Cloud API without the leading "+".
    expect(sendWhatsAppTemplateMessage).toHaveBeenCalledWith("66812345678", "otp_template", "th", [expect.any(String)]);
  });

  it("returns a graceful error instead of throwing when no template is configured", async () => {
    delete process.env.WA_OTP_TEMPLATE_NAME;
    challengeCreate.mockResolvedValue({});

    const result = await requestPhoneOtp("+66812345678");

    expect(result).toEqual({ ok: false, error: expect.stringContaining("WA_OTP_TEMPLATE_NAME") });
    expect(sendWhatsAppTemplateMessage).not.toHaveBeenCalled();
  });

  it("reports success without sending when OTP_DEBUG_MODE=true and no template is configured", async () => {
    delete process.env.WA_OTP_TEMPLATE_NAME;
    process.env.OTP_DEBUG_MODE = "true";
    challengeCreate.mockResolvedValue({});

    const result = await requestPhoneOtp("+66812345678");

    expect(result).toEqual({ ok: true });
    expect(sendWhatsAppTemplateMessage).not.toHaveBeenCalled();
  });

  it("reports success when OTP_DEBUG_MODE=true even if the real WhatsApp send fails", async () => {
    process.env.WA_OTP_TEMPLATE_NAME = "otp_template";
    process.env.OTP_DEBUG_MODE = "true";
    challengeCreate.mockResolvedValue({});
    sendWhatsAppTemplateMessage.mockResolvedValue({ ok: false, error: "template not approved" });

    const result = await requestPhoneOtp("+66812345678");

    expect(result).toEqual({ ok: true });
  });

  it("still returns the real failure when OTP_DEBUG_MODE is unset, even with a template configured", async () => {
    process.env.WA_OTP_TEMPLATE_NAME = "otp_template";
    delete process.env.OTP_DEBUG_MODE;
    challengeCreate.mockResolvedValue({});
    sendWhatsAppTemplateMessage.mockResolvedValue({ ok: false, error: "template not approved" });

    const result = await requestPhoneOtp("+66812345678");

    expect(result).toEqual({ ok: false, error: "template not approved" });
  });
});

describe("verifyPhoneOtp", () => {
  it("succeeds and consumes the challenge when the code matches", async () => {
    challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      codeHash: hashOf("123456"),
      attempts: 0,
    });
    challengeUpdate.mockResolvedValue({});

    const result = await verifyPhoneOtp("+66812345678", "123456");

    expect(result).toEqual({ ok: true });
    expect(challengeUpdate).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it("fails and increments attempts when the code doesn't match", async () => {
    challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      codeHash: hashOf("123456"),
      attempts: 0,
    });
    challengeUpdate.mockResolvedValue({});

    const result = await verifyPhoneOtp("+66812345678", "000000");

    expect(result.ok).toBe(false);
    expect(challengeUpdate).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
      data: { attempts: { increment: 1 } },
    });
  });

  it("fails when there is no unexpired, unconsumed challenge", async () => {
    challengeFindFirst.mockResolvedValue(null);

    const result = await verifyPhoneOtp("+66812345678", "123456");

    expect(result.ok).toBe(false);
  });

  it("fails once attempts already reached the max, without checking the code", async () => {
    challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      codeHash: hashOf("123456"),
      attempts: 5,
    });

    const result = await verifyPhoneOtp("+66812345678", "123456");

    expect(result.ok).toBe(false);
    expect(challengeUpdate).not.toHaveBeenCalled();
  });
});
