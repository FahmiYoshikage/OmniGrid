import { randomUUID } from "node:crypto";
import { decrypt, encrypt } from "@/lib/crypto";
import { prep } from "@/lib/db/client";

export interface RunbookRow {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  body_enc: string;
  shell: string;
  created_at: number;
  updated_at: number;
}

export interface RunbookSummary {
  id: string;
  name: string;
  description: string | null;
  shell: string;
  created_at: number;
  updated_at: number;
}

export interface RunbookDetail extends RunbookSummary {
  body: string;
}

export interface RunbookInput {
  name: string;
  description?: string | null;
  body: string;
  shell?: string;
  actor?: string;
}

export interface RunbookRevisionRow {
  id: string;
  runbook_id: string;
  workspace_id: string;
  revision_number: number;
  shell: string;
  body_enc: string;
  description: string | null;
  created_by: string | null;
  created_at: number;
}

export interface RunbookRevision {
  id: string;
  runbookId: string;
  workspaceId: string;
  revisionNumber: number;
  shell: string;
  body: string;
  description: string | null;
  createdBy: string | null;
  createdAt: number;
}

export interface RunbookExecutionRow {
  id: string;
  job_id: string | null;
  runbook_id: string;
  revision_id: string | null;
  workspace_id: string;
  node_id: string;
  actor: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  exit_code: number | null;
  duration_ms: number | null;
  error: string | null;
  started_at: number;
  finished_at: number | null;
}

export interface RunbookExecution {
  id: string;
  jobId: string | null;
  runbookId: string;
  runbookName?: string;
  revisionId: string | null;
  workspaceId: string;
  nodeId: string;
  nodeName?: string;
  actor: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  exitCode: number | null;
  durationMs: number | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
}

function toSummary(row: RunbookRow): RunbookSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    shell: row.shell,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDetail(row: RunbookRow): RunbookDetail {
  return {
    ...toSummary(row),
    body: decrypt(row.body_enc),
  };
}

function toRevision(row: RunbookRevisionRow): RunbookRevision {
  return {
    id: row.id,
    runbookId: row.runbook_id,
    workspaceId: row.workspace_id,
    revisionNumber: row.revision_number,
    shell: row.shell,
    body: decrypt(row.body_enc),
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export const runbooksRepo = {
  list(workspaceId: string): RunbookSummary[] {
    const rows = prep<[string]>(
      "SELECT * FROM runbooks WHERE workspace_id = ? ORDER BY updated_at DESC, name"
    ).all(workspaceId) as RunbookRow[];
    return rows.map(toSummary);
  },

  get(id: string, workspaceId: string): RunbookDetail | undefined {
    const row = prep<[string, string]>(
      "SELECT * FROM runbooks WHERE id = ? AND workspace_id = ?"
    ).get(id, workspaceId) as RunbookRow | undefined;
    return row ? toDetail(row) : undefined;
  },

  create(input: RunbookInput, workspaceId: string): RunbookSummary {
    const id = randomUUID();
    const revisionId = randomUUID();
    const now = Date.now();
    const shell = input.shell?.trim() || "bash";
    const bodyEnc = encrypt(input.body);

    prep<[string, string, string, string | null, string, string, number, number]>(
      `INSERT INTO runbooks (id, workspace_id, name, description, body_enc, shell, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      workspaceId,
      input.name,
      input.description?.trim() || null,
      bodyEnc,
      shell,
      now,
      now,
    );

    // Record immutable initial revision
    prep<[string, string, string, string, string, string | null, string | null, number]>(
      `INSERT INTO runbook_revisions (id, runbook_id, workspace_id, revision_number, shell, body_enc, description, created_by, created_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`
    ).run(
      revisionId,
      id,
      workspaceId,
      shell,
      bodyEnc,
      input.description?.trim() || null,
      input.actor ?? null,
      now,
    );

    return toSummary(
      prep<[string, string]>(
        "SELECT * FROM runbooks WHERE id = ? AND workspace_id = ?"
      ).get(id, workspaceId) as RunbookRow
    );
  },

  update(id: string, input: RunbookInput, workspaceId: string): RunbookSummary | undefined {
    const existing = prep<[string, string]>(
      "SELECT * FROM runbooks WHERE id = ? AND workspace_id = ?"
    ).get(id, workspaceId) as RunbookRow | undefined;
    if (!existing) return undefined;

    const shell = input.shell?.trim() || existing.shell || "bash";
    const bodyEnc = encrypt(input.body);
    const now = Date.now();

    prep<[string, string | null, string, string, number, string, string]>(
      `UPDATE runbooks
       SET name = ?, description = ?, body_enc = ?, shell = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`
    ).run(
      input.name,
      input.description?.trim() || null,
      bodyEnc,
      shell,
      now,
      id,
      workspaceId,
    );

    // Determine next revision number
    const maxRev = (prep<[string]>(
      "SELECT COALESCE(MAX(revision_number), 0) AS max_num FROM runbook_revisions WHERE runbook_id = ?"
    ).get(id) as { max_num: number }).max_num;

    prep<[string, string, string, number, string, string, string | null, string | null, number]>(
      `INSERT INTO runbook_revisions (id, runbook_id, workspace_id, revision_number, shell, body_enc, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      id,
      workspaceId,
      maxRev + 1,
      shell,
      bodyEnc,
      input.description?.trim() || null,
      input.actor ?? null,
      now,
    );

    return toSummary(
      prep<[string, string]>(
        "SELECT * FROM runbooks WHERE id = ? AND workspace_id = ?"
      ).get(id, workspaceId) as RunbookRow
    );
  },

  delete(id: string, workspaceId: string): boolean {
    const result = prep<[string, string]>(
      "DELETE FROM runbooks WHERE id = ? AND workspace_id = ?"
    ).run(id, workspaceId);
    return result.changes > 0;
  },

  // ─── Revisions ─────────────────────────────────────────────────────────────

  listRevisions(runbookId: string, workspaceId: string): RunbookRevision[] {
    const rows = prep<[string, string]>(
      "SELECT * FROM runbook_revisions WHERE runbook_id = ? AND workspace_id = ? ORDER BY revision_number DESC"
    ).all(runbookId, workspaceId) as RunbookRevisionRow[];
    return rows.map(toRevision);
  },

  getLatestRevision(runbookId: string, workspaceId: string): RunbookRevision | undefined {
    const row = prep<[string, string]>(
      "SELECT * FROM runbook_revisions WHERE runbook_id = ? AND workspace_id = ? ORDER BY revision_number DESC LIMIT 1"
    ).get(runbookId, workspaceId) as RunbookRevisionRow | undefined;
    return row ? toRevision(row) : undefined;
  },

  // ─── Executions ────────────────────────────────────────────────────────────

  recordExecutionStart(input: {
    id?: string;
    jobId?: string | null;
    runbookId: string;
    revisionId?: string | null;
    workspaceId: string;
    nodeId: string;
    actor: string;
    startedAt?: number;
  }): RunbookExecution {
    const id = input.id ?? randomUUID();
    const now = input.startedAt ?? Date.now();

    prep<[string, string | null, string, string | null, string, string, string, number]>(
      `INSERT INTO runbook_executions (id, job_id, runbook_id, revision_id, workspace_id, node_id, actor, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)`
    ).run(
      id,
      input.jobId ?? null,
      input.runbookId,
      input.revisionId ?? null,
      input.workspaceId,
      input.nodeId,
      input.actor,
      now,
    );

    return {
      id,
      jobId: input.jobId ?? null,
      runbookId: input.runbookId,
      revisionId: input.revisionId ?? null,
      workspaceId: input.workspaceId,
      nodeId: input.nodeId,
      actor: input.actor,
      status: "running",
      exitCode: null,
      durationMs: null,
      error: null,
      startedAt: now,
      finishedAt: null,
    };
  },

  recordExecutionFinish(
    id: string,
    workspaceId: string,
    result: {
      status: "succeeded" | "failed" | "cancelled";
      exitCode?: number | null;
      durationMs?: number | null;
      error?: string | null;
      finishedAt?: number;
    }
  ): boolean {
    const now = result.finishedAt ?? Date.now();
    const res = prep<[string, number | null, number | null, string | null, number, string, string]>(
      `UPDATE runbook_executions
       SET status = ?, exit_code = ?, duration_ms = ?, error = ?, finished_at = ?
       WHERE id = ? AND workspace_id = ?`
    ).run(
      result.status,
      result.exitCode ?? null,
      result.durationMs ?? null,
      result.error ?? null,
      now,
      id,
      workspaceId,
    );
    return res.changes > 0;
  },

  listExecutions(
    workspaceId: string,
    options: { runbookId?: string; nodeId?: string; limit?: number } = {}
  ): RunbookExecution[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    let sql = `
      SELECT e.*, r.name AS runbook_name, n.name AS node_name
      FROM runbook_executions e
      LEFT JOIN runbooks r ON r.id = e.runbook_id
      LEFT JOIN nodes n ON n.id = e.node_id
      WHERE e.workspace_id = ?
    `;
    const params: unknown[] = [workspaceId];

    if (options.runbookId) {
      sql += " AND e.runbook_id = ?";
      params.push(options.runbookId);
    }
    if (options.nodeId) {
      sql += " AND e.node_id = ?";
      params.push(options.nodeId);
    }

    sql += " ORDER BY e.started_at DESC LIMIT ?";
    params.push(limit);

    const rows = prep(sql).all(...params) as Array<RunbookExecutionRow & { runbook_name?: string; node_name?: string }>;
    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      runbookId: r.runbook_id,
      runbookName: r.runbook_name,
      revisionId: r.revision_id,
      workspaceId: r.workspace_id,
      nodeId: r.node_id,
      nodeName: r.node_name,
      actor: r.actor,
      status: r.status,
      exitCode: r.exit_code,
      durationMs: r.duration_ms,
      error: r.error,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
    }));
  },
};
