/// A booking's *display* channel: `channel` (LINE/WHATSAPP) when set by the multi-channel entry
/// points (multi-channel-booking-prompt.md, Phases 2-4), else falls back to `source`
/// (ONLINE/WALK_IN/PHONE/ADMIN) for bookings made through the pre-existing paths — see the
/// `Channel` enum's doc comment in schema.prisma for why these are two separate fields.
///
/// Kept free of server-only imports (no `prisma`) so client components can import it directly
/// without pulling Node-only deps like `pg` into the browser bundle.
export const BOOKING_CHANNEL_KEYS = ["LINE", "WHATSAPP", "ONLINE", "WALK_IN", "PHONE", "ADMIN"] as const;
export type BookingChannelKey = (typeof BOOKING_CHANNEL_KEYS)[number];
