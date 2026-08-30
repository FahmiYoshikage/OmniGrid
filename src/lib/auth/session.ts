import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, sha256Hex } from "@/lib/crypto";
import { workspacesRepo } from "@/lib/db/repos/workspaces";
import type { WorkspaceRole } from "./permissions";

export const SESSION_COOKIE = "omnigrid_session";
export const ACTIVE_WORKSPACE_COOKIE = "omnigrid_workspace";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  workspaceId: string;
  role: WorkspaceRole;
}

function parseCookieHeader(cookieHeader: string | undefined): Map<string, string> {
  const result = new Map<string, string>();
  if (!cookieHeader) return result;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!name) continue;
    try {
      result.set(name, decodeURIComponent(rawValue));
    } catch {
      result.set(name, rawValue);
    }
  }
  return result;
}

/** Resolve a session from its encrypted cookie value without depending on Next request APIs. */
function resolveSessionUser(encryptedSessionToken: string | undefined, activeWorkspaceId?: string): SessionUser | null {
  if (!encryptedSessionToken) return null;

  let sessionId: string;
  try {
    sessionId = sha256Hex(decrypt(encryptedSessionToken));
  } catch {
    return null;
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.email, u.avatar_url
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`
    )
    .get(sessionId, Date.now()) as
    | {
        id: string;
        username: string;
        display_name: string | null;
        email: string | null;
        avatar_url: string | null;
      }
    | undefined;

  if (!row) return null;

  const defaultWorkspace = workspacesRepo.ensureDefaultForUser(row.id, row.username);
  const workspace = activeWorkspaceId ? workspacesRepo.get(activeWorkspaceId) : defaultWorkspace;
  if (!workspace) return null;
  const membership = workspacesRepo.getMembership(workspace.id, row.id);
  if (!membership) {
    const defaultMembership = workspacesRepo.getMembership(defaultWorkspace.id, row.id);
    if (!defaultMembership) return null;
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      avatarUrl: row.avatar_url,
      workspaceId: defaultWorkspace.id,
      role: defaultMembership.role,
    };
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    workspaceId: workspace.id,
    role: membership.role,
  };
}

export function getSessionUserFromToken(encryptedSessionToken: string | undefined): SessionUser | null {
  return resolveSessionUser(encryptedSessionToken);
}

/** Resolve a session directly from an HTTP Cookie header, including Socket.IO handshakes. */
export function getSessionUserFromCookieHeader(cookieHeader: string | undefined): SessionUser | null {
  const cookieValues = parseCookieHeader(cookieHeader);
  return resolveSessionUser(
    cookieValues.get(SESSION_COOKIE),
    cookieValues.get(ACTIVE_WORKSPACE_COOKIE),
  );
}

export async function setActiveWorkspaceId(workspaceId: string): Promise<void> {
  const cookieStore = await cookies();
  const secureCookie =
    process.env.OMNIGRID_PUBLIC_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
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
  return resolveSessionUser(
    cookieStore.get(SESSION_COOKIE)?.value,
    cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value,
  );
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
    cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
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
