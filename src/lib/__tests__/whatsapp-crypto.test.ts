import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { constants, createCipheriv, createDecipheriv, generateKeyPairSync, publicEncrypt, randomBytes } from "node:crypto";
import { decryptFlowRequest, encryptFlowResponse, WhatsAppDecryptionError } from "@/lib/whatsapp-crypto";

const originalEnv = { ...process.env };

/// Encrypts a payload exactly the way Meta's WhatsApp client does — this is the "mock encryption
/// round-trip" the multi-channel-booking-prompt.md spec asks for: a fresh AES-128 key per
/// request, wrapped with our RSA public key (OAEP/SHA-256), payload sealed with AES-128-GCM.
function encryptRequestLikeMeta(payload: unknown, publicKey: string) {
  const aesKey = randomBytes(16);
  const iv = randomBytes(16);
  const encryptedAesKey = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, aesKey);
  const cipher = createCipheriv("aes-128-gcm", aesKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedFlowData: Buffer.concat([ciphertext, authTag]).toString("base64"),
    encryptedAesKey: encryptedAesKey.toString("base64"),
    initialVector: iv.toString("base64"),
    aesKey,
    iv,
  };
}

describe("WhatsApp Flow encryption round-trip", () => {
  let publicKey: string;
  let privateKey: string;

  beforeEach(() => {
    const keyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
    process.env.WA_FLOW_PRIVATE_KEY = privateKey;
    delete process.env.WA_FLOW_PASSPHRASE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("decrypts a request encrypted the way WhatsApp would encrypt it", () => {
    const payload = { action: "ping", version: "3.0" };
    const req = encryptRequestLikeMeta(payload, publicKey);

    const result = decryptFlowRequest(req.encryptedFlowData, req.encryptedAesKey, req.initialVector);

    expect(result.body).toEqual(payload);
    expect(result.aesKey).toEqual(req.aesKey);
    expect(result.iv).toEqual(req.iv);
  });

  it("round-trips a response using the bit-flipped IV, matching what the real client does", () => {
    const req = encryptRequestLikeMeta({ action: "ping" }, publicKey);
    const { aesKey, iv } = decryptFlowRequest(req.encryptedFlowData, req.encryptedAesKey, req.initialVector);

    const responseBody = { data: { status: "active" } };
    const encryptedResponse = encryptFlowResponse(responseBody, aesKey, iv);

    const flippedIv = Buffer.from(iv.map((b) => ~b & 0xff));
    const raw = Buffer.from(encryptedResponse, "base64");
    const ciphertext = raw.subarray(0, raw.length - 16);
    const authTag = raw.subarray(raw.length - 16);
    const decipher = createDecipheriv("aes-128-gcm", aesKey, flippedIv);
    decipher.setAuthTag(authTag);
    const decrypted = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8"));

    expect(decrypted).toEqual(responseBody);
  });

  it("throws WhatsAppDecryptionError when the AES key was wrapped with a different RSA key", () => {
    const otherKeyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const req = encryptRequestLikeMeta({ action: "ping" }, otherKeyPair.publicKey);

    expect(() => decryptFlowRequest(req.encryptedFlowData, req.encryptedAesKey, req.initialVector)).toThrow(
      WhatsAppDecryptionError
    );
  });

  it("throws WhatsAppDecryptionError when the ciphertext/auth tag has been tampered with", () => {
    const req = encryptRequestLikeMeta({ action: "ping" }, publicKey);
    const raw = Buffer.from(req.encryptedFlowData, "base64");
    raw[0] ^= 0xff;

    expect(() => decryptFlowRequest(raw.toString("base64"), req.encryptedAesKey, req.initialVector)).toThrow(
      WhatsAppDecryptionError
    );
  });

  it("throws WhatsAppDecryptionError when WA_FLOW_PRIVATE_KEY isn't configured", () => {
    const req = encryptRequestLikeMeta({ action: "ping" }, publicKey);
    delete process.env.WA_FLOW_PRIVATE_KEY;

    expect(() => decryptFlowRequest(req.encryptedFlowData, req.encryptedAesKey, req.initialVector)).toThrow(
      WhatsAppDecryptionError
    );
  });

  it("supports a passphrase-protected private key", () => {
    const keyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: "correct-horse" },
    });
    process.env.WA_FLOW_PRIVATE_KEY = keyPair.privateKey;
    process.env.WA_FLOW_PASSPHRASE = "correct-horse";

    const req = encryptRequestLikeMeta({ action: "ping" }, keyPair.publicKey);
    const result = decryptFlowRequest(req.encryptedFlowData, req.encryptedAesKey, req.initialVector);

    expect(result.body).toEqual({ action: "ping" });
  });
});
