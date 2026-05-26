import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { consumeOAuthRequest } from "@/lib/auth/oauth-requests";
import { fetchGoogleUser, getGoogle } from "@/lib/auth/google";
import { linkIdentityToUser, resolveUserForSignIn } from "@/lib/auth/accounts";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  const requestState = await consumeOAuthRequest("google", state);
  if (!requestState?.codeVerifier) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  try {
    const google = getGoogle();
    const tokens = await google.validateAuthorizationCode(code, requestState.codeVerifier);
    const user = await fetchGoogleUser(tokens.accessToken());

    if (requestState.linkUserId) {
      linkIdentityToUser(requestState.linkUserId, {
        provider: "google",
        providerUserId: user.sub,
        email: user.email ?? null,
        username: user.email?.split("@")[0] ?? user.given_name ?? user.name ?? null,
        displayName: user.name ?? null,
        avatarUrl: user.picture ?? null,
      });
      await createSession(requestState.linkUserId);
      return NextResponse.redirect(new URL("/settings?auth=google-linked", request.url));
    }

    const userId = resolveUserForSignIn(
      {
        provider: "google",
        providerUserId: user.sub,
        email: user.email ?? null,
        username: user.email?.split("@")[0] ?? user.given_name ?? user.name ?? null,
        displayName: user.name ?? null,
        avatarUrl: user.picture ?? null,
      },
      { allowTrustedEmailMatch: Boolean(user.email_verified && user.email) },
    );

    await createSession(userId);
    return NextResponse.redirect(new URL("/auth/success?provider=google", request.url));
  } catch (error) {
    console.error("[auth] Google OAuth callback error:", error);
    if (requestState.linkUserId) {
      return NextResponse.redirect(new URL("/settings?authError=google-link-failed", request.url));
    }
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
