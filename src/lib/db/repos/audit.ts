import { prep } from "@/lib/db/client";

export interface AuditEntry {
  ts: number;
  actor: string;
  action: string;
  node_id?: string | null;
  session_id?: string | null;
  detail?: unknown;
}

export const auditRepo = {
  log(entry: Omit<AuditEntry, "ts"> & { ts?: number; workspaceId?: string }) {
    prep<[string | null, number, string, string, string | null, string | null, string | null]>(
      `INSERT INTO audit_log (workspace_id, ts, actor, action, node_id, session_id, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.workspaceId ?? null,
      entry.ts ?? Date.now(),
      entry.actor,
      entry.action,
      entry.node_id ?? null,
      entry.session_id ?? null,
      entry.detail !== undefined ? JSON.stringify(entry.detail) : null,
    );
  },

  recent(limit = 100, workspaceId?: string): AuditEntry[] {
    const rows = (workspaceId
      ? prep<[string, number]>(
          "SELECT ts, actor, action, node_id, session_id, detail FROM audit_log WHERE workspace_id = ? ORDER BY ts DESC LIMIT ?",
        ).all(workspaceId, limit)
      : prep<[number]>(
          "SELECT ts, actor, action, node_id, session_id, detail FROM audit_log ORDER BY ts DESC LIMIT ?",
        ).all(limit)) as Array<{
      ts: number;
      actor: string;
      action: string;
      node_id: string | null;
      session_id: string | null;
      detail: string | null;
    }>;
    return rows.map((r) => ({
      ...r,
      detail: r.detail ? JSON.parse(r.detail) : undefined,
    }));
  },
};
