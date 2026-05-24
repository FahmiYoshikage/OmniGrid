import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, sha256Hex } from "@/lib/crypto";
import { workspacesRepo } from "@/lib/db/repos/workspaces";

const SESSION_COOKIE = "omnigrid_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  githubId: number;
  username: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  workspaceId: string;
}

/**
 * Create a new session for a user and set the cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const sessionToken = randomBytes(32).toString("hex");
  const sessionId = sha256Hex(sessionToken);
  const now = Date.now();
  const expiresAt = now + SESSION_MAX_AGE_MS;

  db.prepare(
    "INSERT INTO auth_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).run(sessionId, userId, expiresAt, now);

  const cookieStore = await cookies();
  const secureCookie =
    process.env.OMNIGRID_PUBLIC_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE, encrypt(sessionToken), {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return sessionId;
}

/**
 * Get the current session user from the cookie.
 * Returns null if no valid session exists.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const encryptedSessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!encryptedSessionToken) return null;

  let sessionId: string;
  try {
    sessionId = sha256Hex(decrypt(encryptedSessionToken));
  } catch {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.github_id, u.username, u.display_name, u.email, u.avatar_url
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`
    )
    .get(sessionId, Date.now()) as
    | {
        id: string;
        github_id: number;
        username: string;
        display_name: string | null;
        email: string | null;
        avatar_url: string | null;
      }
    | undefined;

  if (!row) {
    // Session expired or invalid — clean up cookie
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  const workspace = workspacesRepo.ensureDefaultForUser(row.id, row.username);
  return {
    id: row.id,
    githubId: row.github_id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    workspaceId: workspace.id,
  };
}

/**
 * Delete the current session (logout).
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const encryptedSessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (encryptedSessionToken) {
    const db = getDb();
    try {
      db.prepare("DELETE FROM auth_sessions WHERE id = ?").run(sha256Hex(decrypt(encryptedSessionToken)));
    } catch {}
    cookieStore.delete(SESSION_COOKIE);
  }
}

/**
 * Clean up expired sessions (called periodically).
 */
export function cleanupExpiredSessions(): number {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM auth_sessions WHERE expires_at <= ?")
    .run(Date.now());
  return result.changes;
}
