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
  log(entry: Omit<AuditEntry, "ts"> & { ts?: number }) {
    prep<[number, string, string, string | null, string | null, string | null]>(
      `INSERT INTO audit_log (ts, actor, action, node_id, session_id, detail)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      entry.ts ?? Date.now(),
      entry.actor,
      entry.action,
      entry.node_id ?? null,
      entry.session_id ?? null,
      entry.detail !== undefined ? JSON.stringify(entry.detail) : null,
    );
  },

  recent(limit = 100): AuditEntry[] {
    const rows = prep<[number]>(
      "SELECT ts, actor, action, node_id, session_id, detail FROM audit_log ORDER BY ts DESC LIMIT ?",
    ).all(limit) as Array<{
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
