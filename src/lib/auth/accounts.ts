import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { encrypt, sha256Hex } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

export type AuthProvider = "github" | "google" | "email";

export interface IdentityProfile {
  provider: AuthProvider;
  providerUserId: string;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface AuthMethodSummary {
  provider: AuthProvider;
  providerUserId: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: number;
}

interface UserRow {
  id: string;
  github_id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function sanitizeUsername(input?: string | null) {
  const value = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return value || null;
}

function usernameFromProfile(profile: IdentityProfile) {
  return (
    sanitizeUsername(profile.username) ??
    sanitizeUsername(profile.email?.split("@")[0]) ??
    sanitizeUsername(profile.displayName) ??
    `user-${randomBytes(4).toString("hex")}`
  );
}

function nextSyntheticGithubId() {
  const db = getDb();
  const row = db.prepare("SELECT MIN(github_id) AS min_id FROM users").get() as { min_id: number | null } | undefined;
  if (row?.min_id !== null && row?.min_id !== undefined && row.min_id <= 0) return row.min_id - 1;
  return -1;
}

function getUser(userId: string) {
  const db = getDb();
  return db.prepare("SELECT id, github_id, username, display_name, email, avatar_url FROM users WHERE id = ?").get(userId) as UserRow | undefined;
}

function getIdentity(provider: AuthProvider, providerUserId: string) {
  const db = getDb();
  return db.prepare(
    `SELECT user_id, provider, provider_user_id, email, username, display_name, avatar_url
     FROM auth_identities
     WHERE provider = ? AND provider_user_id = ?`
  ).get(provider, providerUserId) as
    | {
        user_id: string;
        provider: AuthProvider;
        provider_user_id: string;
        email: string | null;
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
      }
    | undefined;
}

function getUserIdByTrustedEmail(email: string) {
  const db = getDb();
  const existingIdentity = db.prepare(
    `SELECT user_id
     FROM auth_identities
     WHERE email = ?
     ORDER BY created_at ASC
     LIMIT 1`
  ).get(email) as { user_id: string } | undefined;
  if (existingIdentity) return existingIdentity.user_id;

  const existingUser = db.prepare(
    `SELECT id
     FROM users
     WHERE LOWER(COALESCE(email, '')) = ?
     ORDER BY created_at ASC
     LIMIT 1`
  ).get(email) as { id: string } | undefined;

  return existingUser?.id ?? null;
}

function createUser(profile: IdentityProfile) {
  const db = getDb();
  const now = Date.now();
  const id = randomUUID();
  const normalizedEmail = normalizeEmail(profile.email);
  const username = usernameFromProfile(profile);
  const githubId = profile.provider === "github" ? Number(profile.providerUserId) : nextSyntheticGithubId();

  db.prepare(
    `INSERT INTO users (id, github_id, username, display_name, email, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, githubId, username, profile.displayName ?? null, normalizedEmail, profile.avatarUrl ?? null, now, now);

  return id;
}

function syncUserProfile(userId: string, profile: IdentityProfile) {
  const existingUser = getUser(userId);
  if (!existingUser) throw new Error("User not found.");

  const nextUsername =
    profile.provider === "github" && sanitizeUsername(profile.username)
      ? sanitizeUsername(profile.username)!
      : existingUser.username;

  getDb()
    .prepare(
      `UPDATE users
       SET username = ?,
           display_name = ?,
           email = ?,
           avatar_url = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .run(
      nextUsername,
      profile.displayName ?? existingUser.display_name,
      normalizeEmail(profile.email) ?? existingUser.email,
      profile.avatarUrl ?? existingUser.avatar_url,
      Date.now(),
      userId,
    );
}

export function listAuthMethods(userId: string): AuthMethodSummary[] {
  const db = getDb();
  return db.prepare(
    `SELECT provider,
            provider_user_id AS providerUserId,
            email,
            username,
            display_name AS displayName,
            avatar_url AS avatarUrl,
            created_at AS createdAt
     FROM auth_identities
     WHERE user_id = ?
     ORDER BY created_at ASC`
  ).all(userId) as AuthMethodSummary[];
}

export function linkIdentityToUser(userId: string, profile: IdentityProfile) {
  const db = getDb();
  const now = Date.now();
  const providerUserId = profile.provider === "email"
    ? normalizeEmail(profile.providerUserId) ?? profile.providerUserId
    : profile.providerUserId;
  const normalizedEmail = normalizeEmail(profile.email);
  const existing = getIdentity(profile.provider, providerUserId);

  if (existing && existing.user_id !== userId) {
    throw new Error(`This ${profile.provider} account is already linked to another OmniGrid user.`);
  }

  if (existing) {
    db.prepare(
      `UPDATE auth_identities
       SET email = ?, username = ?, display_name = ?, avatar_url = ?, updated_at = ?
       WHERE provider = ? AND provider_user_id = ?`
    ).run(
      normalizedEmail,
      sanitizeUsername(profile.username),
      profile.displayName ?? null,
      profile.avatarUrl ?? null,
      now,
      profile.provider,
      providerUserId,
    );
  } else {
    db.prepare(
      `INSERT INTO auth_identities (
        id, user_id, provider, provider_user_id, email, username, display_name, avatar_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `${profile.provider}:${providerUserId}`,
      userId,
      profile.provider,
      providerUserId,
      normalizedEmail,
      sanitizeUsername(profile.username),
      profile.displayName ?? null,
      profile.avatarUrl ?? null,
      now,
      now,
    );
  }

  syncUserProfile(userId, { ...profile, providerUserId, email: normalizedEmail });
  return userId;
}

export function resolveUserForSignIn(profile: IdentityProfile, options?: { allowTrustedEmailMatch?: boolean }) {
  const providerUserId = profile.provider === "email"
    ? normalizeEmail(profile.providerUserId) ?? profile.providerUserId
    : profile.providerUserId;
  const existing = getIdentity(profile.provider, providerUserId);
  if (existing) {
    linkIdentityToUser(existing.user_id, { ...profile, providerUserId });
    return existing.user_id;
  }

  const normalizedEmail = normalizeEmail(profile.email);
  if (options?.allowTrustedEmailMatch && normalizedEmail) {
    const matchingUserId = getUserIdByTrustedEmail(normalizedEmail);
    if (matchingUserId) {
      linkIdentityToUser(matchingUserId, { ...profile, providerUserId, email: normalizedEmail });
      return matchingUserId;
    }
  }

  const userId = createUser({ ...profile, providerUserId, email: normalizedEmail });
  linkIdentityToUser(userId, { ...profile, providerUserId, email: normalizedEmail });
  return userId;
}

export function createEmailLoginToken(input: { email: string; linkUserId?: string | null }) {
  const env = getEnv();
  const base = env.OMNIGRID_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("Missing OMNIGRID_PUBLIC_URL environment variable. Required for email login links.");
  }

  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new Error("A valid email address is required.");
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000;

  const db = getDb();
  db.prepare(
    `INSERT INTO auth_email_tokens (token_hash, email, link_user_id, expires_at, created_at, consumed_at)
     VALUES (?, ?, ?, ?, ?, NULL)`
  ).run(tokenHash, normalizedEmail, input.linkUserId ?? null, expiresAt, now);
  db.prepare("DELETE FROM auth_email_tokens WHERE expires_at <= ? OR consumed_at IS NOT NULL").run(now);

  return {
    email: normalizedEmail,
    linkUrl: `${base}/api/auth/email/verify?token=${encodeURIComponent(encrypt(token))}`,
    expiresAt,
  };
}

export function consumeEmailLoginToken(rawToken: string) {
  const tokenHash = sha256Hex(rawToken);
  const db = getDb();
  const row = db.prepare(
    `SELECT token_hash, email, link_user_id, expires_at, created_at, consumed_at
     FROM auth_email_tokens
     WHERE token_hash = ? AND expires_at > ? AND consumed_at IS NULL`
  ).get(tokenHash, Date.now()) as
    | {
        token_hash: string;
        email: string;
        link_user_id: string | null;
        expires_at: number;
        created_at: number;
        consumed_at: number | null;
      }
    | undefined;

  if (!row) return null;

  db.prepare("UPDATE auth_email_tokens SET consumed_at = ? WHERE token_hash = ?").run(Date.now(), tokenHash);
  db.prepare("DELETE FROM auth_email_tokens WHERE expires_at <= ? OR consumed_at IS NOT NULL").run(Date.now());

  return {
    email: row.email,
    linkUserId: row.link_user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
