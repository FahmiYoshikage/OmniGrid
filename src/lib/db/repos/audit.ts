import { prep } from "@/lib/db/client";

export interface AuditEntry {
  ts: number;
  actor: string;
  action: string;
  node_id?: string | null;
  session_id?: string | null;
  detail?: unknown;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
}

interface AuditQuery {
  workspaceId: string;
  action?: string;
  query?: string;
  limit?: number;
  offset?: number;
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

  page({ workspaceId, action, query, limit = 25, offset = 0 }: AuditQuery): AuditPage {
    const clauses = ["workspace_id = ?"];
    const params: Array<string | number> = [workspaceId];
    if (action) {
      clauses.push("action = ?");
      params.push(action);
    }
    if (query) {
      clauses.push("(actor LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR detail LIKE ? ESCAPE '\\')");
      const escaped = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      params.push(escaped, escaped, escaped);
    }
    const where = clauses.join(" AND ");
    const total = (prep(`SELECT COUNT(*) AS count FROM audit_log WHERE ${where}`).get(...params) as { count: number }).count;
    const rows = prep(
      `SELECT ts, actor, action, node_id, session_id, detail FROM audit_log WHERE ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`,
    ).all(...params, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)) as Array<{
      ts: number;
      actor: string;
      action: string;
      node_id: string | null;
      session_id: string | null;
      detail: string | null;
    }>;
    return {
      total,
      entries: rows.map((row) => ({
        ...row,
        detail: row.detail ? JSON.parse(row.detail) : undefined,
      })),
    };
  },

  actions(workspaceId: string): string[] {
    const rows = prep<[string]>(
      "SELECT DISTINCT action FROM audit_log WHERE workspace_id = ? ORDER BY action",
    ).all(workspaceId) as Array<{ action: string }>;
    return rows.map((row) => row.action);
  },
};
