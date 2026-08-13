import { Google } from "arctic";
import { getEnv } from "@/lib/env";

let cachedGoogle: Google | null = null;
let cachedRedirectUri: string | null = null;

export function getGoogle(): Google {
  const env = getEnv();
  const redirectUri = getGoogleOAuthRedirectUri();

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables.");
  }

  if (cachedGoogle && cachedRedirectUri === redirectUri) return cachedGoogle;

  cachedGoogle = new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  cachedRedirectUri = redirectUri;
  return cachedGoogle;
}

export function getGoogleOAuthRedirectUri(): string {
  const env = getEnv();
  const base = env.OMNIGRID_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("Missing OMNIGRID_PUBLIC_URL environment variable. Required for Google OAuth redirect_uri.");
  }
  return `${base}/api/auth/google/callback`;
}

export interface GoogleUser {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Google API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<GoogleUser>;
}
