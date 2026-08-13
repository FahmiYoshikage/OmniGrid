import { GitHub } from "arctic";
import { getEnv } from "@/lib/env";

let _github: GitHub | null = null;
let _lastRedirectUri: string | null = null;

export function getGitHub(): GitHub {
  const env = getEnv();
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const redirectUri = getGitHubOAuthRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables. " +
        "Please configure them in .env.local for GitHub OAuth login."
    );
  }

  if (_github && _lastRedirectUri === redirectUri) return _github;

  _github = new GitHub(clientId, clientSecret, redirectUri);
  _lastRedirectUri = redirectUri;
  return _github;
}

export function getGitHubOAuthRedirectUri(): string {
  const env = getEnv();
  const base = env.OMNIGRID_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Missing OMNIGRID_PUBLIC_URL environment variable. " +
        "Required for GitHub OAuth redirect_uri."
    );
  }
  return `${base}/api/auth/github/callback`;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  verified_email?: string | null;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const [userRes, emailRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }),
  ]);

  if (!userRes.ok) {
    throw new Error(`GitHub API error: ${userRes.status} ${userRes.statusText}`);
  }

  const user = (await userRes.json()) as GitHubUser;

  if (!emailRes.ok) {
    return user;
  }

  const emails = (await emailRes.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;

  const verifiedEmail = emails.find((entry) => entry.primary && entry.verified)?.email
    ?? emails.find((entry) => entry.verified)?.email
    ?? user.email;

  return {
    ...user,
    email: verifiedEmail ?? user.email,
    verified_email: verifiedEmail ?? null,
  };
}
