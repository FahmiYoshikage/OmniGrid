import { randomUUID } from "node:crypto";
import { getDb, prep } from "@/lib/db/client";

export type SshHostKeyStatus = "pending" | "trusted" | "revoked";

export interface SshHostKeyRow {
  id: string;
  workspace_id: string;
  node_id: string;
  fingerprint: string;
  status: SshHostKeyStatus;
  first_seen_at: number;
  last_seen_at: number;
  trusted_at: number | null;
  trusted_by: string | null;
  revoked_at: number | null;
  revoked_by: string | null;
}

function get(workspaceId: string, nodeId: string, fingerprint: string): SshHostKeyRow | undefined {
  return prep<[string, string, string]>(
    "SELECT * FROM ssh_host_keys WHERE workspace_id = ? AND node_id = ? AND fingerprint = ?",
  ).get(workspaceId, nodeId, fingerprint) as SshHostKeyRow | undefined;
}

function getById(workspaceId: string, nodeId: string, id: string): SshHostKeyRow | undefined {
  return prep<[string, string, string]>(
    "SELECT * FROM ssh_host_keys WHERE workspace_id = ? AND node_id = ? AND id = ?",
  ).get(workspaceId, nodeId, id) as SshHostKeyRow | undefined;
}

export const sshHostKeysRepo = {
  list(workspaceId: string, nodeId: string): SshHostKeyRow[] {
    return prep<[string, string]>(
      `SELECT * FROM ssh_host_keys WHERE workspace_id = ? AND node_id = ?
       ORDER BY CASE status WHEN 'trusted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, last_seen_at DESC`,
    ).all(workspaceId, nodeId) as SshHostKeyRow[];
  },

  observe(workspaceId: string, nodeId: string, fingerprint: string): SshHostKeyRow {
    const existing = get(workspaceId, nodeId, fingerprint);
    const now = Date.now();
    if (existing) {
      prep<[number, string]>("UPDATE ssh_host_keys SET last_seen_at = ? WHERE id = ?").run(now, existing.id);
      return { ...existing, last_seen_at: now };
    }
    const id = randomUUID();
    prep<[string, string, string, string, SshHostKeyStatus, number, number]>(
      `INSERT INTO ssh_host_keys (id, workspace_id, node_id, fingerprint, status, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, workspaceId, nodeId, fingerprint, "pending", now, now);
    return get(workspaceId, nodeId, fingerprint)!;
  },

  trust(workspaceId: string, nodeId: string, id: string, actorId: string, replace = false): SshHostKeyRow | undefined {
    const key = getById(workspaceId, nodeId, id);
    if (!key || key.status === "revoked") return undefined;
    const now = Date.now();
    const tx = getDb().transaction(() => {
      if (replace) {
        prep<[number, string, string, string, string]>(
          `UPDATE ssh_host_keys SET status = 'revoked', revoked_at = ?, revoked_by = ?
           WHERE workspace_id = ? AND node_id = ? AND status = 'trusted' AND fingerprint <> ?`,
        ).run(now, actorId, workspaceId, nodeId, key.fingerprint);
      }
      prep<[number, string, string]>(
        `UPDATE ssh_host_keys SET status = 'trusted', trusted_at = ?, trusted_by = ?,
         revoked_at = NULL, revoked_by = NULL WHERE id = ?`,
      ).run(now, actorId, key.id);
    });
    tx();
    return getById(workspaceId, nodeId, id);
  },

  revoke(workspaceId: string, nodeId: string, id: string, actorId: string): SshHostKeyRow | undefined {
    const key = getById(workspaceId, nodeId, id);
    if (!key) return undefined;
    const now = Date.now();
    prep<[number, string, string]>(
      "UPDATE ssh_host_keys SET status = 'revoked', revoked_at = ?, revoked_by = ? WHERE id = ?",
    ).run(now, actorId, key.id);
    return getById(workspaceId, nodeId, id);
  },
};
