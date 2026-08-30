import { cookies } from "next/headers";
import { generateState } from "arctic";
import { getDb } from "@/lib/db/client";

export type OAuthProvider = "github" | "google";

interface OAuthRequestRow {
  state: string;
  provider: OAuthProvider;
  code_verifier: string | null;
  link_user_id: string | null;
  expires_at: number;
}

function getStateCookieName(provider: OAuthProvider) {
  return `${provider}_oauth_state`;
}

export async function createOAuthRequest(input: {
  provider: OAuthProvider;
  secureCookie: boolean;
  codeVerifier?: string;
  linkUserId?: string | null;
}) {
  const state = generateState();
  const now = Date.now();
  const expiresAt = now + 600_000;
  const db = getDb();
  db.prepare(
    `INSERT INTO auth_oauth_requests (state, provider, code_verifier, link_user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(state, input.provider, input.codeVerifier ?? null, input.linkUserId ?? null, expiresAt, now);

  db.prepare("DELETE FROM auth_oauth_requests WHERE expires_at <= ?").run(now);

  const cookieStore = await cookies();
  cookieStore.set(getStateCookieName(input.provider), state, {
    httpOnly: true,
    secure: input.secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return { state, expiresAt };
}

export async function consumeOAuthRequest(provider: OAuthProvider, state: string) {
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(getStateCookieName(provider))?.value;
  cookieStore.delete(getStateCookieName(provider));

  const db = getDb();
  const row = db.prepare(
    `SELECT state, provider, code_verifier, link_user_id, expires_at
     FROM auth_oauth_requests
     WHERE state = ? AND provider = ? AND expires_at > ?`
  ).get(state, provider, Date.now()) as OAuthRequestRow | undefined;

  db.prepare("DELETE FROM auth_oauth_requests WHERE state = ?").run(state);
  db.prepare("DELETE FROM auth_oauth_requests WHERE expires_at <= ?").run(Date.now());

  if (!row) return null;
  if (!cookieState || cookieState !== state) return null;

  return {
    state: row.state,
    provider: row.provider,
    codeVerifier: row.code_verifier,
    linkUserId: row.link_user_id,
    expiresAt: row.expires_at,
  };
}
