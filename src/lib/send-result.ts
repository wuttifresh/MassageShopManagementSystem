/// Shared return shape for every outbound-message sender (LINE push/reply, WhatsApp
/// text/template/flow) — lets notification-log.ts log a precise success/failure reason without
/// coupling the messaging modules to the logging module (multi-channel-booking-prompt.md, Phase 5).
export type SendResult = { ok: true } | { ok: false; error: string };
