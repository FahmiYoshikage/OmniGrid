import { getDb } from "@/lib/db/client";
import { randomUUID } from "node:crypto";
import type { GitHubUser } from "./github";

/**
 * Find or create a user from GitHub OAuth data.
 * If the user already exists (by github_id), update their profile info.
 */
export function upsertGitHubUser(ghUser: GitHubUser): string {
  const db = getDb();
  const now = Date.now();

  const existing = db
    .prepare("SELECT id FROM users WHERE github_id = ?")
    .get(ghUser.id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE users
       SET username = ?, display_name = ?, email = ?, avatar_url = ?, updated_at = ?
       WHERE github_id = ?`
    ).run(
      ghUser.login,
      ghUser.name,
      ghUser.email,
      ghUser.avatar_url,
      now,
      ghUser.id
    );
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, github_id, username, display_name, email, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, ghUser.id, ghUser.login, ghUser.name, ghUser.email, ghUser.avatar_url, now, now);

  return id;
}
