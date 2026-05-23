import { NextResponse } from "next/server";
import { generateState } from "arctic";
import { getGitHub, getOAuthRedirectUri } from "@/lib/auth/github";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";

/**
 * GET /api/auth/github
 * Redirects the user to GitHub for OAuth authorization.
 *
 * State is stored both in a cookie and in the database to handle edge cases
 * where the cookie doesn't survive the redirect chain (e.g. after logout,
 * or when the browser is aggressive about SameSite enforcement).
 */
export async function GET() {
  const github = getGitHub();
  const state = generateState();

  const url = github.createAuthorizationURL(state, ["read:user", "user:email"]);
  url.searchParams.set("redirect_uri", getOAuthRedirectUri());

  // Store state in database with 10-minute expiry
  const db = getDb();
  db.prepare(
    "INSERT INTO oauth_states (state, expires_at) VALUES (?, ?)"
  ).run(state, Date.now() + 600_000);

  // Also set cookie as primary mechanism
  const cookieStore = await cookies();
  cookieStore.set("github_oauth_state", state, {
    httpOnly: true,
    secure: false, // localhost dev — changed to false to prevent cookie loss
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(url);
}
