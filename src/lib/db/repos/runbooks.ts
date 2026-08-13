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
    const now = Date.now();
    prep<[string, string, string, string | null, string, string, number, number]>(
      `INSERT INTO runbooks (id, workspace_id, name, description, body_enc, shell, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      workspaceId,
      input.name,
      input.description?.trim() || null,
      encrypt(input.body),
      input.shell?.trim() || "bash",
      now,
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

    prep<[string, string | null, string, string, number, string, string]>(
      `UPDATE runbooks
       SET name = ?, description = ?, body_enc = ?, shell = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`
    ).run(
      input.name,
      input.description?.trim() || null,
      encrypt(input.body),
      input.shell?.trim() || existing.shell || "bash",
      Date.now(),
      id,
      workspaceId,
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
};
