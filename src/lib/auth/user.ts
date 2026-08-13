import type { GitHubUser } from "./github";
import { resolveUserForSignIn } from "./accounts";

export function upsertGitHubUser(ghUser: GitHubUser): string {
  return resolveUserForSignIn(
    {
      provider: "github",
      providerUserId: String(ghUser.id),
      email: ghUser.email ?? ghUser.verified_email ?? null,
      username: ghUser.login,
      displayName: ghUser.name,
      avatarUrl: ghUser.avatar_url,
    },
    { allowTrustedEmailMatch: false },
  );
}
