import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type {
  CreateJobInput,
  JobStatus,
  OperationEvent,
  OperationJob,
  JobTransition,
} from "./types";

const MAX_EVENT_DATA_BYTES = 64 * 1024;
const TERMINAL_STATUSES: JobStatus[] = ["succeeded", "failed", "cancelled"];

type JobDbRow = {
  id: string; workspace_id: string; operation: string; payload_json: string;
  status: JobStatus; attempt: number; available_at: number; created_at: number;
  updated_at: number; started_at: number | null; finished_at: number | null;
  lease_owner: string | null; lease_expires_at: number | null;
  cancel_requested_at: number | null; result_json: string | null; error: string | null;
};

function decode(value: string | null): unknown {
  return value === null ? null : JSON.parse(value);
}

function job(row: JobDbRow | undefined): OperationJob | undefined {
  if (!row) return undefined;
  return {
    id: row.id, workspaceId: row.workspace_id, operation: row.operation,
    payload: decode(row.payload_json), status: row.status, attempt: row.attempt,
    availableAt: row.available_at, createdAt: row.created_at, updatedAt: row.updated_at,
    startedAt: row.started_at, finishedAt: row.finished_at, leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at, cancelRequestedAt: row.cancel_requested_at,
    result: decode(row.result_json), error: row.error,
  };
}

function json(value: unknown, name: string): string {
  let encoded: string;
  try { encoded = JSON.stringify(value ?? {}) ?? "{}"; } catch { throw new Error(`${name} must be JSON serializable`); }
  if (name === "event data" && Buffer.byteLength(encoded, "utf8") > MAX_EVENT_DATA_BYTES) {
    throw new Error("event data exceeds 65536 bytes");
  }
  return encoded;
}

function read(db: ReturnType<typeof getDb>, id: string, workspaceId: string) {
  return job(db.prepare("SELECT * FROM operation_jobs WHERE id = ? AND workspace_id = ?").get(id, workspaceId) as JobDbRow | undefined);
}

export const jobsRepo = {
  create(input: CreateJobInput, workspaceId: string): OperationJob {
    const id = randomUUID();
    const now = Date.now();
    getDb().prepare(`INSERT INTO operation_jobs
      (id, workspace_id, operation, payload_json, available_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, workspaceId, input.operation, json(input.payload, "payload"), input.availableAt ?? now, now, now);
    return read(getDb(), id, workspaceId)!;
  },

  get(id: string, workspaceId: string): OperationJob | undefined { return read(getDb(), id, workspaceId); },

  list(workspaceId: string, options: { status?: JobStatus; limit?: number; offset?: number } = {}): OperationJob[] {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);
    const rows = (options.status
      ? getDb().prepare("SELECT * FROM operation_jobs WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(workspaceId, options.status, limit, offset)
      : getDb().prepare("SELECT * FROM operation_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(workspaceId, limit, offset)) as JobDbRow[];
    return rows.map((row) => job(row)!);
  },

  lease(workspaceId: string, workerId: string, leaseMs = 30_000, now = Date.now()): OperationJob | undefined {
    const db = getDb();
    return db.transaction(() => {
      const row = db.prepare("SELECT id FROM operation_jobs WHERE workspace_id = ? AND status = 'pending' AND available_at <= ? ORDER BY created_at, id LIMIT 1").get(workspaceId, now) as { id: string } | undefined;
      if (!row) return undefined;
      db.prepare(`UPDATE operation_jobs SET status = 'running', attempt = attempt + 1,
        started_at = COALESCE(started_at, ?), updated_at = ?, lease_owner = ?, lease_expires_at = ?
        WHERE id = ? AND workspace_id = ? AND status = 'pending'`).run(now, now, workerId, now + Math.max(1, leaseMs), row.id, workspaceId);
      return read(db, row.id, workspaceId);
    })();
  },

  leaseJob(id: string, workspaceId: string, workerId: string, leaseMs = 30_000, now = Date.now()): OperationJob | undefined {
    const db = getDb();
    return db.transaction(() => {
      const changed = db.prepare(`UPDATE operation_jobs SET status = 'running', attempt = attempt + 1,
        started_at = COALESCE(started_at, ?), updated_at = ?, lease_owner = ?, lease_expires_at = ?
        WHERE id = ? AND workspace_id = ? AND status IN ('pending', 'queued')`).run(now, now, workerId, now + Math.max(1, leaseMs), id, workspaceId);
      return changed.changes ? read(db, id, workspaceId) : undefined;
    })();
  },

  leaseNext(workspaceId: string, workerId: string, leaseMs?: number, now?: number) {
    return this.lease(workspaceId, workerId, leaseMs, now);
  },

  acquireLease(workspaceId: string, workerId: string, leaseMs?: number, now?: number) {
    return this.lease(workspaceId, workerId, leaseMs, now);
  },

  leaseGlobal(workerId: string, leaseMs = 30_000, now = Date.now()): OperationJob | undefined {
    const db = getDb();
    return db.transaction(() => {
      const row = db.prepare(
        "SELECT id, workspace_id FROM operation_jobs WHERE status = 'pending' AND available_at <= ? ORDER BY created_at, id LIMIT 1"
      ).get(now) as { id: string; workspace_id: string } | undefined;
      if (!row) return undefined;
      db.prepare(`UPDATE operation_jobs SET status = 'running', attempt = attempt + 1,
        started_at = COALESCE(started_at, ?), updated_at = ?, lease_owner = ?, lease_expires_at = ?
        WHERE id = ? AND workspace_id = ? AND status = 'pending'`).run(now, now, workerId, now + Math.max(1, leaseMs), row.id, row.workspace_id);
      return read(db, row.id, row.workspace_id);
    })();
  },

  acquireLeaseGlobal(workerId: string, leaseMs?: number, now?: number) {
    return this.leaseGlobal(workerId, leaseMs, now);
  },

  markRunning(id: string, workspaceId: string, workerId: string, now = Date.now()): OperationJob | undefined {
    const db = getDb();
    const changed = db.prepare("UPDATE operation_jobs SET updated_at = ? WHERE id = ? AND workspace_id = ? AND status = 'running' AND lease_owner = ?").run(now, id, workspaceId, workerId);
    return changed.changes ? read(db, id, workspaceId) : undefined;
  },

  transition(id: string, workspaceId: string, transition: JobTransition, workerId?: string, now = Date.now()): OperationJob | undefined {
    const db = getDb();
    if (transition.status === "running" || transition.status === "pending" || transition.status === "queued" || transition.status === "leased") throw new Error("invalid job transition");
    const terminal = TERMINAL_STATUSES.includes(transition.status);
    const result = transition.result === undefined ? null : json(transition.result, "result");
    const changed = db.prepare(`UPDATE operation_jobs SET status = ?, updated_at = ?,
      finished_at = CASE WHEN ? THEN ? ELSE finished_at END,
      result_json = ?, error = ?, lease_owner = NULL, lease_expires_at = NULL
      WHERE id = ? AND workspace_id = ? AND status IN ('running', 'cancel_requested')
      AND (? IS NULL OR lease_owner = ?)`).run(transition.status, now, terminal ? 1 : 0, now, result, transition.error ?? null, id, workspaceId, workerId ?? null, workerId ?? null);
    return changed.changes ? read(db, id, workspaceId) : undefined;
  },

  requestCancel(id: string, workspaceId: string, now = Date.now()): OperationJob | undefined {
    const db = getDb();
    db.prepare(`UPDATE operation_jobs SET status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE 'cancel_requested' END,
      cancel_requested_at = ?, finished_at = CASE WHEN status = 'pending' THEN ? ELSE finished_at END,
      updated_at = ? WHERE id = ? AND workspace_id = ? AND status IN ('pending', 'running')`).run(now, now, now, id, workspaceId);
    return read(db, id, workspaceId);
  },

  cancelRequest(id: string, workspaceId: string, now = Date.now()) {
    return this.requestCancel(id, workspaceId, now);
  },

  appendEvent(jobId: string, workspaceId: string, type: string, data?: unknown, now = Date.now()): OperationEvent | undefined {
    const db = getDb();
    return db.transaction(() => {
      if (!read(db, jobId, workspaceId)) return undefined;
      const next = (db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM operation_events WHERE job_id = ? AND workspace_id = ?").get(jobId, workspaceId) as { sequence: number }).sequence;
      const result = db.prepare("INSERT INTO operation_events (job_id, workspace_id, sequence, event_type, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(jobId, workspaceId, next, type, json(data, "event data"), now);
      return { id: Number(result.lastInsertRowid), jobId, workspaceId, sequence: next, type, data: data ?? {}, createdAt: now };
    })();
  },

  listEvents(jobId: string, workspaceId: string, limit = 500): OperationEvent[] {
    const rows = getDb().prepare("SELECT * FROM operation_events WHERE job_id = ? AND workspace_id = ? ORDER BY sequence LIMIT ?").all(jobId, workspaceId, Math.min(Math.max(limit, 1), 1000)) as Array<{ id: number; job_id: string; workspace_id: string; sequence: number; event_type: string; data_json: string; created_at: number }>;
    return rows.map((row) => ({ id: row.id, jobId: row.job_id, workspaceId: row.workspace_id, sequence: row.sequence, type: row.event_type, data: decode(row.data_json), createdAt: row.created_at }));
  },

  recoverExpiredLeases(now = Date.now()): number {
    return getDb().prepare(`UPDATE operation_jobs SET status = CASE WHEN status = 'cancel_requested' THEN 'cancelled' ELSE 'pending' END,
      lease_owner = NULL, lease_expires_at = NULL, finished_at = CASE WHEN status = 'cancel_requested' THEN ? ELSE finished_at END,
      updated_at = ? WHERE status IN ('running', 'cancel_requested') AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?`).run(now, now, now).changes;
  },

  recoverExpired(now = Date.now()) {
    return this.recoverExpiredLeases(now);
  },

  prune(workspaceId: string, before: number, limit = 1000): number {
    return getDb().prepare(`DELETE FROM operation_jobs WHERE workspace_id = ? AND status IN ('succeeded', 'failed', 'cancelled') AND finished_at IS NOT NULL AND finished_at < ? AND id IN (SELECT id FROM operation_jobs WHERE workspace_id = ? AND status IN ('succeeded', 'failed', 'cancelled') AND finished_at IS NOT NULL AND finished_at < ? ORDER BY finished_at LIMIT ?)`).run(workspaceId, before, workspaceId, before, Math.min(Math.max(limit, 1), 10_000)).changes;
  },

  retention(workspaceId: string, before: number, limit = 1000) {
    return this.prune(workspaceId, before, limit);
  },
};

export const operationJobsRepo = jobsRepo;
