import { randomUUID } from "node:crypto";
import { prep } from "@/lib/db/client";

export interface WorkspaceRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "workspace";
}

export const workspacesRepo = {
  get(id: string): WorkspaceRow | undefined {
    return prep<[string]>("SELECT * FROM workspaces WHERE id = ?").get(id) as WorkspaceRow | undefined;
  },

  getDefaultForUser(userId: string): WorkspaceRow | undefined {
    return prep<[string]>("SELECT * FROM workspaces WHERE owner_id = ? ORDER BY created_at ASC LIMIT 1").get(userId) as WorkspaceRow | undefined;
  },

  ensureDefaultForUser(userId: string, username: string): WorkspaceRow {
    const existing = this.getDefaultForUser(userId);
    if (existing) return existing;

    const id = randomUUID();
    const now = Date.now();
    const base = slugify(username);
    let slug = base;
    let suffix = 1;
    while (prep<[string]>("SELECT id FROM workspaces WHERE slug = ?").get(slug)) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    prep<[string, string, string, string, number, number]>(
      "INSERT INTO workspaces (id, owner_id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, userId, `${username}'s workspace`, slug, now, now);
    return this.get(id)!;
  },
};
