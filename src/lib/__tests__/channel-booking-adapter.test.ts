import { describe, expect, it, afterEach } from "vitest";
import { messageTriggersBooking, getBookingLinkUrl, getBookingLinkText } from "@/lib/channel-booking-adapter";

const originalUrl = process.env.NEXTAUTH_URL;

afterEach(() => {
  process.env.NEXTAUTH_URL = originalUrl;
});

describe("messageTriggersBooking", () => {
  it("matches when the text contains the booking keyword", () => {
    expect(messageTriggersBooking("อยากจองคิวพรุ่งนี้")).toBe(true);
    expect(messageTriggersBooking("จอง")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(messageTriggersBooking("สวัสดีค่ะ")).toBe(false);
  });

  it("handles missing/non-string input without throwing", () => {
    expect(messageTriggersBooking(undefined)).toBe(false);
    expect(messageTriggersBooking(null)).toBe(false);
    expect(messageTriggersBooking("")).toBe(false);
  });
});

describe("getBookingLinkUrl", () => {
  it("builds a /book-now URL from NEXTAUTH_URL, stripping a trailing slash", () => {
    process.env.NEXTAUTH_URL = "https://example.com/";
    expect(getBookingLinkUrl()).toBe("https://example.com/book-now");
  });

  it("works when NEXTAUTH_URL has no trailing slash", () => {
    process.env.NEXTAUTH_URL = "https://example.com";
    expect(getBookingLinkUrl()).toBe("https://example.com/book-now");
  });
});

describe("getBookingLinkText", () => {
  it("includes the booking link", () => {
    process.env.NEXTAUTH_URL = "https://example.com";
    expect(getBookingLinkText()).toContain("https://example.com/book-now");
  });
});
