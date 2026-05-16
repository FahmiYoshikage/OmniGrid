import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * AES-256-GCM authenticated encryption for credential-at-rest.
 *
 * Wire format (single base64 string):
 *   [12-byte IV][16-byte auth tag][ciphertext]
 *
 * Why GCM: authenticated, fast, hardware-accelerated on every modern CPU.
 * Why a single packed blob: keeps DB schema simple (one BLOB/TEXT column),
 * and we never have to worry about a row being half-rotated.
 *
 * Performance: key buffer is derived once and reused; cipher instances are
 * cheap to spin up per-call (~µs), so we don't pool them.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let keyCache: Buffer | null = null;

function getKey(): Buffer {
  if (keyCache) return keyCache;
  const hex = getEnv().OMNIGRID_MASTER_KEY;
  keyCache = Buffer.from(hex, "hex");
  if (keyCache.length !== 32) {
    throw new Error("OMNIGRID_MASTER_KEY must decode to exactly 32 bytes");
  }
  return keyCache;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Ciphertext too short / malformed");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

/** Convenience for one-off generation in scripts (e.g. setup wizard). */
export function generateMasterKeyHex(): string {
  return randomBytes(32).toString("hex");
}
