import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db/client";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, key] = combinedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, KEY_LENGTH);
    if (keyBuffer.length !== derivedKey.length) return false;
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function setUserPassword(userId: string, password: string): void {
  const db = getDb();
  const passwordHash = hashPassword(password);
  const now = Date.now();

  db.prepare(
    `INSERT INTO auth_passwords (user_id, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       password_hash = excluded.password_hash,
       updated_at = excluded.updated_at`
  ).run(userId, passwordHash, now, now);
}

export function hasUserPassword(userId: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT 1 FROM auth_passwords WHERE user_id = ?")
    .get(userId);
  return Boolean(row);
}

export function verifyUserCredentials(
  identifier: string,
  password: string
): { id: string; username: string; email: string | null; displayName: string | null } | null {
  const db = getDb();
  const cleanIdentifier = identifier.trim().toLowerCase();
  if (!cleanIdentifier || !password) return null;

  const user = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.display_name, p.password_hash
       FROM users u
       JOIN auth_passwords p ON p.user_id = u.id
       WHERE LOWER(u.username) = ? OR LOWER(COALESCE(u.email, '')) = ?
       LIMIT 1`
    )
    .get(cleanIdentifier, cleanIdentifier) as
    | {
        id: string;
        username: string;
        email: string | null;
        display_name: string | null;
        password_hash: string;
      }
    | undefined;

  if (!user || !user.password_hash) return null;
  if (!verifyPassword(password, user.password_hash)) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
  };
}
