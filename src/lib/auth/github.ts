import { GitHub } from "arctic";
import { getEnv } from "@/lib/env";

/**
 * GitHub OAuth 2.0 client via arctic.
 *
 * Required env vars:
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 *   OMNIGRID_PUBLIC_URL (used for dynamic redirect_uri)
 */

let _github: GitHub | null = null;
let _lastRedirectUri: string | null = null;

export function getGitHub(): GitHub {
  const env = getEnv();
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const redirectUri = getOAuthRedirectUri();

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

export function getOAuthRedirectUri(): string {
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
}

/**
 * Fetch the authenticated GitHub user profile using an access token.
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<GitHubUser>;
}
