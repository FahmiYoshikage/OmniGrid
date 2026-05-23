import { NextRequest, NextResponse } from "next/server";
import { getGitHub, getOAuthRedirectUri, fetchGitHubUser } from "@/lib/auth/github";
import { upsertGitHubUser } from "@/lib/auth/user";
import { createSession } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";

/**
 * GET /api/auth/github/callback
 * Handles the OAuth callback from GitHub, creates user + session, and redirects.
 *
 * State validation uses a dual approach:
 * 1. Try cookie first (fastest, standard approach)
 * 2. Fall back to database lookup if cookie is missing
 *    (handles cases where cookie didn't survive the redirect chain)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  const cookieStore = await cookies();
  const storedStateCookie = cookieStore.get("github_oauth_state")?.value;

  // Validate state: try cookie first, then database fallback
  let stateValid = false;

  if (storedStateCookie && state === storedStateCookie) {
    stateValid = true;
  } else {
    // Fallback: check database for the state
    const db = getDb();
    const row = db.prepare(
      "SELECT state FROM oauth_states WHERE state = ? AND expires_at > ?"
    ).get(state, Date.now()) as { state: string } | undefined;

    if (row) {
      stateValid = true;
    }
  }

  if (!stateValid) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  // Clean up: delete state from cookie and database
  cookieStore.delete("github_oauth_state");
  const db = getDb();
  db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);

  // Also clean up any expired states
  db.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").run(Date.now());

  try {
    const github = getGitHub();
    const tokens = await github.validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();
    const ghUser = await fetchGitHubUser(accessToken);

    // Upsert user in database
    const userId = upsertGitHubUser(ghUser);

    // Create session
    await createSession(userId);

    return NextResponse.redirect(new URL("/auth/success", request.url));
  } catch (error) {
    console.error("[auth] GitHub OAuth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
