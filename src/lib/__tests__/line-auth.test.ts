import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { verifyLineIdToken } from "@/lib/line-auth";

const originalChannelId = process.env.LINE_CHANNEL_ID;
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.LINE_CHANNEL_ID = "test-channel-id";
});

afterEach(() => {
  process.env.LINE_CHANNEL_ID = originalChannelId;
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("verifyLineIdToken", () => {
  it("returns the verified identity when LINE's server confirms the token", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: "U1234567890", name: "สมชาย", aud: "test-channel-id" }),
    }) as unknown as typeof fetch;

    const result = await verifyLineIdToken("valid-token");

    expect(result).toEqual({ sub: "U1234567890", name: "สมชาย", picture: undefined });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.line.me/oauth2/v2.1/verify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns null when LINE rejects the token (expired/invalid)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "invalid_request",
    }) as unknown as typeof fetch;

    await expect(verifyLineIdToken("expired-token")).resolves.toBeNull();
  });

  it("returns null when the response has no sub claim", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "no sub here" }),
    }) as unknown as typeof fetch;

    await expect(verifyLineIdToken("weird-token")).resolves.toBeNull();
  });

  it("returns null (never throws) when the network request fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(verifyLineIdToken("any-token")).resolves.toBeNull();
  });

  it("returns null without calling LINE at all when LINE_CHANNEL_ID isn't configured", async () => {
    delete process.env.LINE_CHANNEL_ID;
    global.fetch = vi.fn();

    await expect(verifyLineIdToken("any-token")).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null immediately for an empty token without calling LINE", async () => {
    global.fetch = vi.fn();

    await expect(verifyLineIdToken("")).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
