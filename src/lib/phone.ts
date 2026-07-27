/// Normalizes a Thai mobile number to E.164 (e.g. "+66812345678") for use as a Customer
/// `channelUserId` (Channel.WEB — see /book-now). Only mobile numbers are accepted: 10 digits
/// starting with 0, second digit 6/8/9, e.g. 08X/09X/06X-XXX-XXXX.
const THAI_MOBILE_LOCAL = /^0[689]\d{8}$/;
const THAI_MOBILE_INTL = /^\+66[689]\d{8}$/;
const THAI_MOBILE_INTL_NO_PLUS = /^66[689]\d{8}$/;

export function normalizeThaiMobile(input: string): string | null {
  const trimmed = input.replace(/[\s()-]/g, "");

  if (THAI_MOBILE_LOCAL.test(trimmed)) return `+66${trimmed.slice(1)}`;
  if (THAI_MOBILE_INTL.test(trimmed)) return trimmed;
  if (THAI_MOBILE_INTL_NO_PLUS.test(trimmed)) return `+${trimmed}`;

  return null;
}
