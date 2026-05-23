import { NextResponse } from "next/server";
import { generateState } from "arctic";
import { getGitHub, getOAuthRedirectUri } from "@/lib/auth/github";
import { cookies } from "next/headers";

/**
 * GET /api/auth/github
 * Redirects the user to GitHub for OAuth authorization.
 */
export async function GET() {
  const github = getGitHub();
  const state = generateState();

  const url = github.createAuthorizationURL(state, ["read:user", "user:email"]);
  url.searchParams.set("redirect_uri", getOAuthRedirectUri());

  const cookieStore = await cookies();
  cookieStore.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return NextResponse.redirect(url);
}
