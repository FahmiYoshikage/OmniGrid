import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import {
  hashPassword,
  hasUserPassword,
  setUserPassword,
  verifyPassword,
  verifyUserCredentials,
} from "./passwords";

function createUser(username: string, email?: string) {
  const db = getDb();
  const userId = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, github_id, username, display_name, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, Math.floor(Math.random() * -1_000_000), username, username, email ?? null, now, now);
  return userId;
}

beforeAll(() => {
  migrate();
});

afterAll(() => {
  getDb().prepare("DELETE FROM users").run();
});

describe("passwords and local authentication", () => {
  it("hashes passwords securely with salt and verifies matches", () => {
    const raw = "SuperSecretP@ssw0rd!123";
    const hash = hashPassword(raw);

    expect(hash).toContain(":");
    expect(verifyPassword(raw, hash)).toBe(true);
    expect(verifyPassword("WrongPassword123!", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("stores user password, checks existence, and verifies credentials via username and email", () => {
    const userId = createUser("operator-bob", "bob@omnigrid.internal");

    expect(hasUserPassword(userId)).toBe(false);

    setUserPassword(userId, "B0bSecurePassw0rd!");
    expect(hasUserPassword(userId)).toBe(true);

    // Verify via username
    const authByUsername = verifyUserCredentials("operator-bob", "B0bSecurePassw0rd!");
    expect(authByUsername).not.toBeNull();
    expect(authByUsername?.id).toBe(userId);
    expect(authByUsername?.username).toBe("operator-bob");

    // Case-insensitive username check
    const authCase = verifyUserCredentials("OPERATOR-BOB", "B0bSecurePassw0rd!");
    expect(authCase).not.toBeNull();
    expect(authCase?.id).toBe(userId);

    // Verify via email
    const authByEmail = verifyUserCredentials("bob@omnigrid.internal", "B0bSecurePassw0rd!");
    expect(authByEmail).not.toBeNull();
    expect(authByEmail?.id).toBe(userId);

    // Wrong password check
    const authWrong = verifyUserCredentials("operator-bob", "incorrect-pwd");
    expect(authWrong).toBeNull();

    // Unknown user check
    const authUnknown = verifyUserCredentials("non-existent-user", "any-pwd");
    expect(authUnknown).toBeNull();
  });
});
