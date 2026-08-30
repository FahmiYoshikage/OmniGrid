import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generateMasterKeyHex, sha256Hex } from "./index";

describe("credential encryption", () => {
  it("round-trips UTF-8 plaintext with a fresh nonce", () => {
    const plaintext = "ssh-key: secret value \u2713";
    const first = encrypt(plaintext);
    const second = encrypt(plaintext);

    expect(decrypt(first)).toBe(plaintext);
    expect(decrypt(second)).toBe(plaintext);
    expect(first).not.toBe(second);
  });

  it("rejects truncated and tampered ciphertext", () => {
    expect(() => decrypt(Buffer.alloc(28).toString("base64"))).toThrow(
      "Ciphertext too short / malformed",
    );

    const payload = Buffer.from(encrypt("do not alter"), "base64");
    payload[payload.length - 1] ^= 1;
    expect(() => decrypt(payload.toString("base64"))).toThrow();
  });
});

describe("crypto utilities", () => {
  it("generates a 32-byte hexadecimal master key", () => {
    expect(generateMasterKeyHex()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("computes a standard SHA-256 digest", () => {
    expect(sha256Hex("omnigrid")).toBe(
      createHash("sha256").update("omnigrid").digest("hex"),
    );
  });
});
