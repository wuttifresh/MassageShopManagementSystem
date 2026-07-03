import { createCipheriv, createDecipheriv, constants, privateDecrypt } from "node:crypto";

const AUTH_TAG_LENGTH = 16;

export class WhatsAppDecryptionError extends Error {}

export type DecryptedFlowRequest = {
  body: unknown;
  aesKey: Buffer;
  iv: Buffer;
};

/// Implements Meta's WhatsApp Flows Data Exchange encryption spec (coding rule #5: WhatsApp
/// identity/data is only ever trusted via this encrypted channel, never a raw request field).
/// Per request, WhatsApp generates a fresh AES-128 key, encrypts it with our RSA public key
/// (OAEP/SHA-256), and encrypts the JSON payload with that AES key using AES-128-GCM. We hold the
/// matching RSA private key (WA_FLOW_PRIVATE_KEY) and must unwrap both layers before trusting
/// anything in the body.
export function decryptFlowRequest(
  encryptedFlowData: string,
  encryptedAesKey: string,
  initialVector: string
): DecryptedFlowRequest {
  const privateKeyPem = process.env.WA_FLOW_PRIVATE_KEY;
  if (!privateKeyPem) throw new WhatsAppDecryptionError("WA_FLOW_PRIVATE_KEY is not configured");

  let aesKey: Buffer;
  try {
    aesKey = privateDecrypt(
      {
        key: privateKeyPem,
        passphrase: process.env.WA_FLOW_PASSPHRASE || undefined,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedAesKey, "base64")
    );
  } catch {
    throw new WhatsAppDecryptionError("Failed to unwrap the AES key with our RSA private key");
  }

  const iv = Buffer.from(initialVector, "base64");
  const flowDataBuffer = Buffer.from(encryptedFlowData, "base64");
  if (flowDataBuffer.length <= AUTH_TAG_LENGTH) {
    throw new WhatsAppDecryptionError("Encrypted flow data is too short to contain a GCM auth tag");
  }
  const ciphertext = flowDataBuffer.subarray(0, flowDataBuffer.length - AUTH_TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - AUTH_TAG_LENGTH);

  try {
    const decipher = createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { body: JSON.parse(decrypted.toString("utf-8")), aesKey, iv };
  } catch {
    // Wrong key, tampered ciphertext, or bad auth tag all land here — GCM authentication failing
    // is exactly the case this whole scheme exists to catch, so treat it as untrusted input.
    throw new WhatsAppDecryptionError("Failed to decrypt/authenticate the flow data payload");
  }
}

/// Encrypts the response with the *same* AES key but a bit-flipped IV (every byte inverted) — this
/// exact transformation is mandated by Meta's spec so the client can derive the response IV
/// without a second RSA round-trip. Returns raw base64 ciphertext+tag, which is the literal HTTP
/// response body Meta expects (not wrapped in JSON).
export function encryptFlowResponse(responseBody: unknown, aesKey: Buffer, requestIv: Buffer): string {
  const flippedIv = Buffer.from(requestIv.map((byte) => ~byte & 0xff));
  const cipher = createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(responseBody), "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString("base64");
}
