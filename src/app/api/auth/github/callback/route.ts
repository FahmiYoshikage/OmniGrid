import { NextRequest, NextResponse } from "next/server";
import { getGitHub, getOAuthRedirectUri, fetchGitHubUser } from "@/lib/auth/github";
import { upsertGitHubUser } from "@/lib/auth/user";
import { createSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

/**
 * GET /api/auth/github/callback
 * Handles the OAuth callback from GitHub, creates user + session, and redirects.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("github_oauth_state")?.value;

  // Validate state to prevent CSRF
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  // Clean up the state cookie
  cookieStore.delete("github_oauth_state");

  try {
    const github = getGitHub();
    const tokens = await github.validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();
    const ghUser = await fetchGitHubUser(accessToken);

    // Upsert user in database
    const userId = upsertGitHubUser(ghUser);

    // Create session
    await createSession(userId);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("[auth] GitHub OAuth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
