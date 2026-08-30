import { randomUUID } from "node:crypto";
import { getDb, prep } from "@/lib/db/client";
import type { WorkspaceRole } from "@/lib/auth/permissions";

export interface WorkspaceRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
}

export interface WorkspaceMembership extends WorkspaceRow {
  role: WorkspaceRole;
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
    return prep<[string]>("SELECT w.* FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id WHERE m.user_id = ? ORDER BY w.created_at ASC LIMIT 1").get(userId) as WorkspaceRow | undefined;
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

    const createWorkspace = getDb().transaction(() => {
      prep<[string, string, string, string, number, number]>(
        "INSERT INTO workspaces (id, owner_id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, userId, `${username}'s workspace`, slug, now, now);
      prep<[string, string, number, number]>(
        "INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at) VALUES (?, ?, 'owner', ?, ?)",
      ).run(id, userId, now, now);
    });
    createWorkspace();
    return this.get(id)!;
  },

  getMembership(workspaceId: string, userId: string): { role: WorkspaceRole } | undefined {
    return prep<[string, string]>("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(workspaceId, userId) as { role: WorkspaceRole } | undefined;
  },

  listForUser(userId: string): WorkspaceMembership[] {
    return prep<[string]>(
      `SELECT w.*, m.role FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id
       WHERE m.user_id = ? ORDER BY w.created_at ASC`,
    ).all(userId) as WorkspaceMembership[];
  },

  listMembers(workspaceId: string) {
    return prep<[string]>(
      `SELECT m.user_id, m.role, m.created_at, u.username, u.display_name, u.email, u.avatar_url
       FROM workspace_members m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END, u.username`,
    ).all(workspaceId) as Array<{ user_id: string; role: WorkspaceRole; created_at: number; username: string; display_name: string | null; email: string | null; avatar_url: string | null }>;
  },

  setRole(workspaceId: string, userId: string, role: WorkspaceRole): boolean {
    if (role === "owner") throw new Error("Owner transfer requires a dedicated workflow");
    const result = prep<[WorkspaceRole, number, string, string]>(
      "UPDATE workspace_members SET role = ?, updated_at = ? WHERE workspace_id = ? AND user_id = ? AND role != 'owner'",
    ).run(role, Date.now(), workspaceId, userId);
    return result.changes > 0;
  },

  removeMember(workspaceId: string, userId: string): boolean {
    const result = prep<[string, string]>("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role != 'owner'").run(workspaceId, userId);
    return result.changes > 0;
  },
};
