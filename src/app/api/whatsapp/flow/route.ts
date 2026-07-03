import { NextResponse } from "next/server";
import { BookingServiceError } from "@/lib/booking-service";
import { decryptFlowRequest, encryptFlowResponse, WhatsAppDecryptionError } from "@/lib/whatsapp-crypto";
import { routeFlowAction, type FlowActionRequest } from "@/lib/whatsapp-flow-screens";

// Decrypts/encrypts with node:crypto (RSA-OAEP + AES-128-GCM) — never edge (coding rule #7).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EncryptedEnvelope = { encrypted_flow_data: string; encrypted_aes_key: string; initial_vector: string };

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.encrypted_flow_data === "string" && typeof v.encrypted_aes_key === "string" && typeof v.initial_vector === "string";
}

function isFlowActionRequest(value: unknown): value is FlowActionRequest {
  return typeof value === "object" && value !== null && typeof (value as { action?: unknown }).action === "string";
}

export async function POST(request: Request) {
  const raw: unknown = await request.json().catch(() => null);

  if (!isEncryptedEnvelope(raw)) {
    // Malformed envelope — can't even attempt decryption. Meta's spec reserves HTTP 421 for
    // "couldn't process this request as an encrypted Flow payload", which covers this case too.
    return new NextResponse(null, { status: 421 });
  }

  let decrypted;
  try {
    decrypted = decryptFlowRequest(raw.encrypted_flow_data, raw.encrypted_aes_key, raw.initial_vector);
  } catch (error) {
    if (error instanceof WhatsAppDecryptionError) {
      // Meta's spec: 421 tells the WhatsApp client to refresh/retry the key exchange — never
      // respond 200 when we couldn't authenticate the request (coding rule #5).
      return new NextResponse(null, { status: 421 });
    }
    throw error;
  }

  if (!isFlowActionRequest(decrypted.body)) {
    const encrypted = encryptFlowResponse({ error_msg: "รูปแบบข้อมูลไม่ถูกต้อง" }, decrypted.aesKey, decrypted.iv);
    return new NextResponse(encrypted, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  let responseBody: unknown;
  try {
    responseBody = await routeFlowAction(decrypted.body);
  } catch (error) {
    if (error instanceof BookingServiceError) {
      // Business-logic errors (bad input, expired session, rate limit) stay inside the encrypted
      // channel with HTTP 200 — per Meta's spec, only decryption failures use HTTP 421. The Flow
      // client shows `error_msg` as a toast and lets the customer retry the same screen.
      responseBody = { error_msg: error.message };
    } else {
      throw error;
    }
  }

  const encrypted = encryptFlowResponse(responseBody, decrypted.aesKey, decrypted.iv);
  return new NextResponse(encrypted, { status: 200, headers: { "Content-Type": "text/plain" } });
}
