import { describe, expect, it } from "vitest";
import { normalizeThaiMobile } from "@/lib/phone";

describe("normalizeThaiMobile", () => {
  it("normalizes a local 0-prefixed number", () => {
    expect(normalizeThaiMobile("0812345678")).toBe("+66812345678");
  });

  it("strips spaces and dashes before normalizing", () => {
    expect(normalizeThaiMobile("081-234-5678")).toBe("+66812345678");
    expect(normalizeThaiMobile("081 234 5678")).toBe("+66812345678");
  });

  it("accepts an already-E.164 number unchanged", () => {
    expect(normalizeThaiMobile("+66812345678")).toBe("+66812345678");
  });

  it("accepts international format without the leading +", () => {
    expect(normalizeThaiMobile("66812345678")).toBe("+66812345678");
  });

  it("accepts all three Thai mobile prefixes (6/8/9)", () => {
    expect(normalizeThaiMobile("0612345678")).toBe("+66612345678");
    expect(normalizeThaiMobile("0912345678")).toBe("+66912345678");
  });

  it("rejects a landline-style number (leading 02)", () => {
    expect(normalizeThaiMobile("0212345678")).toBeNull();
  });

  it("rejects the wrong number of digits", () => {
    expect(normalizeThaiMobile("081234567")).toBeNull();
    expect(normalizeThaiMobile("08123456789")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(normalizeThaiMobile("not a phone number")).toBeNull();
    expect(normalizeThaiMobile("")).toBeNull();
  });
});
