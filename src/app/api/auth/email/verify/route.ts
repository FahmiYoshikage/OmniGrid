import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { consumeEmailLoginToken, linkIdentityToUser, resolveUserForSignIn } from "@/lib/auth/accounts";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get("token");
  if (!tokenParam) {
    return NextResponse.redirect(new URL("/login?error=invalid_email_link", request.url));
  }

  let token: string;
  try {
    token = decrypt(tokenParam);
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_email_link", request.url));
  }

  const payload = consumeEmailLoginToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?error=invalid_email_link", request.url));
  }

  try {
    if (payload.linkUserId) {
      linkIdentityToUser(payload.linkUserId, {
        provider: "email",
        providerUserId: payload.email,
        email: payload.email,
        username: payload.email.split("@")[0] ?? null,
        displayName: null,
        avatarUrl: null,
      });
      await createSession(payload.linkUserId);
      return NextResponse.redirect(new URL("/settings?auth=email-linked", request.url));
    }

    const userId = resolveUserForSignIn(
      {
        provider: "email",
        providerUserId: payload.email,
        email: payload.email,
        username: payload.email.split("@")[0] ?? null,
        displayName: null,
        avatarUrl: null,
      },
      { allowTrustedEmailMatch: true },
    );

    await createSession(userId);
    return NextResponse.redirect(new URL("/auth/success?provider=email", request.url));
  } catch (error) {
    console.error("[auth] Email verification error:", error);
    if (payload.linkUserId) {
      return NextResponse.redirect(new URL("/settings?authError=email-link-failed", request.url));
    }
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
