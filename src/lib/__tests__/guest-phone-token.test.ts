import { describe, expect, it } from "vitest";
import { issueGuestPhoneToken, verifyGuestPhoneToken } from "@/lib/guest-phone-token";

describe("guest-phone-token", () => {
  it("verifies a token it issued for the same phone", () => {
    const token = issueGuestPhoneToken("+66812345678", "secret");
    expect(verifyGuestPhoneToken(token, "+66812345678", "secret")).toBe(true);
  });

  it("rejects the token when checked against a different phone", () => {
    const token = issueGuestPhoneToken("+66812345678", "secret");
    expect(verifyGuestPhoneToken(token, "+66899999999", "secret")).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = issueGuestPhoneToken("+66812345678", "secret-a");
    expect(verifyGuestPhoneToken(token, "+66812345678", "secret-b")).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifyGuestPhoneToken("not-a-token", "+66812345678", "secret")).toBe(false);
  });
});
