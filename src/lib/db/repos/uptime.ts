import { randomUUID } from "node:crypto";
import { prep, getDb } from "@/lib/db/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MonitorKind = "http" | "tcp" | "ping";

export interface UptimeMonitorRow {
  id: string;
  workspace_id: string;
  name: string;
  kind: MonitorKind;
  target: string;
  interval_sec: number;
  timeout_ms: number;
  method: string | null;
  expected_status: number | null;
  headers_json: string | null;
  body: string | null;
  enabled: number;
  notify: number;
  created_at: number;
  updated_at: number;
}

export interface UptimeMonitorInput {
  name: string;
  kind: MonitorKind;
  target: string;
  interval_sec?: number;
  timeout_ms?: number;
  method?: string;
  expected_status?: number | null;
  headers_json?: string | null;
  body?: string | null;
  enabled?: boolean;
  notify?: boolean;
}

export interface UptimeHistoryRow {
  id: number;
  workspace_id: string;
  monitor_id: string;
  ts: number;
  ok: number;
  status_code: number | null;
  latency_ms: number | null;
  error: string | null;
  region: string;
}

export interface UptimeIncidentRow {
  id: string;
  workspace_id: string;
  monitor_id: string;
  started_at: number;
  resolved_at: number | null;
  cause: string | null;
  checks_failed: number;
  created_at: number;
}

/** Aggregated stats for a single monitor. */
export interface MonitorStats {
  monitor: UptimeMonitorRow;
  /** Latest check result */
  lastCheck: UptimeHistoryRow | null;
  /** Current status: 'up' | 'down' | 'unknown' */
  currentStatus: "up" | "down" | "unknown";
  /** Uptime percentage over the last 24h */
  uptime24h: number;
  /** Uptime percentage over the last 7 days */
  uptime7d: number;
  /** Uptime percentage over the last 30 days */
  uptime30d: number;
  /** Average latency over the last 24h (ms) */
  avgLatency24h: number | null;
  /** Last 90 time-slots (each ~24 min for 24h, or ~8h for 30d) for the status bar */
  statusBar: Array<{ ts: number; ok: boolean; latency: number | null }>;
  /** Total number of checks in last 24h */
  totalChecks24h: number;
  /** Number of successful checks in last 24h */
  successChecks24h: number;
  /** Active incident if any */
  activeIncident: UptimeIncidentRow | null;
  /** Recent incidents (last 10) */
  recentIncidents: UptimeIncidentRow[];
  /** P95 latency over 24h */
  p95Latency24h: number | null;
  /** Minimum latency over 24h */
  minLatency24h: number | null;
  /** Maximum latency over 24h */
  maxLatency24h: number | null;
  /** Certificate expiry for HTTPS targets (days) */
  certExpiryDays: number | null;
}

// ─── Monitors CRUD ────────────────────────────────────────────────────────────

export const uptimeRepo = {
  // ── Monitors ────────────────────────────────────────────────────────────────

  listMonitors(workspaceId: string): UptimeMonitorRow[] {
    return prep<[string]>(
      "SELECT * FROM uptime_monitors WHERE workspace_id = ? ORDER BY name",
    ).all(workspaceId) as UptimeMonitorRow[];
  },

  listEnabledMonitors(workspaceId?: string): UptimeMonitorRow[] {
    if (workspaceId) {
      return prep<[string]>(
        "SELECT * FROM uptime_monitors WHERE workspace_id = ? AND enabled = 1 ORDER BY name",
      ).all(workspaceId) as UptimeMonitorRow[];
    }
    return prep<[]>(
      "SELECT * FROM uptime_monitors WHERE enabled = 1 ORDER BY name",
    ).all() as UptimeMonitorRow[];
  },

  /** Get all enabled monitors across all workspaces (for the background checker). */
  listAllEnabled(): UptimeMonitorRow[] {
    return prep<[]>(
      "SELECT * FROM uptime_monitors WHERE enabled = 1 ORDER BY workspace_id, name",
    ).all() as UptimeMonitorRow[];
  },

  getMonitor(id: string, workspaceId?: string): UptimeMonitorRow | undefined {
    const query = workspaceId
      ? prep<[string, string]>(
          "SELECT * FROM uptime_monitors WHERE id = ? AND workspace_id = ?",
        ).get(id, workspaceId)
      : prep<[string]>(
          "SELECT * FROM uptime_monitors WHERE id = ?",
        ).get(id);
    return query as UptimeMonitorRow | undefined;
  },

  createMonitor(input: UptimeMonitorInput, workspaceId: string): UptimeMonitorRow {
    const id = randomUUID();
    const now = Date.now();
    prep<[
      string, string, string, MonitorKind, string,
      number, number, string | null, number | null,
      string | null, string | null, number, number,
      number, number,
    ]>(
      `INSERT INTO uptime_monitors (
        id, workspace_id, name, kind, target,
        interval_sec, timeout_ms, method, expected_status,
        headers_json, body, enabled, notify,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      workspaceId,
      input.name.trim(),
      input.kind,
      input.target.trim(),
      input.interval_sec ?? 60,
      input.timeout_ms ?? 10000,
      input.kind === "http" ? (input.method ?? "GET") : null,
      input.expected_status ?? null,
      input.headers_json ?? null,
      input.body ?? null,
      input.enabled !== false ? 1 : 0,
      input.notify !== false ? 1 : 0,
      now,
      now,
    );
    return this.getMonitor(id, workspaceId)!;
  },

  updateMonitor(id: string, input: UptimeMonitorInput, workspaceId: string): UptimeMonitorRow | undefined {
    const now = Date.now();
    prep<[
      string, MonitorKind, string, number, number,
      string | null, number | null, string | null, string | null,
      number, number, number, string, string,
    ]>(
      `UPDATE uptime_monitors SET
        name = ?, kind = ?, target = ?, interval_sec = ?, timeout_ms = ?,
        method = ?, expected_status = ?, headers_json = ?, body = ?,
        enabled = ?, notify = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ?`,
    ).run(
      input.name.trim(),
      input.kind,
      input.target.trim(),
      input.interval_sec ?? 60,
      input.timeout_ms ?? 10000,
      input.kind === "http" ? (input.method ?? "GET") : null,
      input.expected_status ?? null,
      input.headers_json ?? null,
      input.body ?? null,
      input.enabled !== false ? 1 : 0,
      input.notify !== false ? 1 : 0,
      now,
      id,
      workspaceId,
    );
    return this.getMonitor(id, workspaceId);
  },

  deleteMonitor(id: string, workspaceId: string): void {
    prep<[string, string]>(
      "DELETE FROM uptime_monitors WHERE id = ? AND workspace_id = ?",
    ).run(id, workspaceId);
  },

  toggleMonitor(id: string, enabled: boolean, workspaceId: string): void {
    prep<[number, number, string, string]>(
      "UPDATE uptime_monitors SET enabled = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).run(enabled ? 1 : 0, Date.now(), id, workspaceId);
  },

  // ── History ─────────────────────────────────────────────────────────────────

  recordCheck(entry: {
    workspaceId: string;
    monitorId: string;
    ok: boolean;
    statusCode?: number | null;
    latencyMs?: number | null;
    error?: string | null;
  }): void {
    prep<[string, string, number, number, number | null, number | null, string | null]>(
      `INSERT INTO uptime_history (workspace_id, monitor_id, ts, ok, status_code, latency_ms, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.workspaceId,
      entry.monitorId,
      Date.now(),
      entry.ok ? 1 : 0,
      entry.statusCode ?? null,
      entry.latencyMs ?? null,
      entry.error ?? null,
    );
  },

  /** Last N checks for a single monitor. */
  recentChecks(monitorId: string, limit = 100): UptimeHistoryRow[] {
    return prep<[string, number]>(
      "SELECT * FROM uptime_history WHERE monitor_id = ? ORDER BY ts DESC LIMIT ?",
    ).all(monitorId, limit) as UptimeHistoryRow[];
  },

  /** Get the latest check for a monitor. */
  lastCheck(monitorId: string): UptimeHistoryRow | null {
    const row = prep<[string]>(
      "SELECT * FROM uptime_history WHERE monitor_id = ? ORDER BY ts DESC LIMIT 1",
    ).get(monitorId);
    return (row as UptimeHistoryRow) ?? null;
  },

  /** Compute uptime percentage for a monitor over a time range. */
  uptimePercentage(monitorId: string, sinceMs: number): { total: number; success: number; pct: number } {
    const row = prep<[string, number]>(
      `SELECT COUNT(*) as total, SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) as success
       FROM uptime_history WHERE monitor_id = ? AND ts >= ?`,
    ).get(monitorId, sinceMs) as { total: number; success: number } | undefined;
    const total = row?.total ?? 0;
    const success = row?.success ?? 0;
    return { total, success, pct: total > 0 ? (success / total) * 100 : 100 };
  },

  /** Average/P95/Min/Max latency for a monitor over a time range. */
  latencyStats(monitorId: string, sinceMs: number): {
    avg: number | null;
    p95: number | null;
    min: number | null;
    max: number | null;
  } {
    const row = prep<[string, number]>(
      `SELECT
        AVG(latency_ms) as avg,
        MIN(latency_ms) as min,
        MAX(latency_ms) as max
       FROM uptime_history WHERE monitor_id = ? AND ts >= ? AND latency_ms IS NOT NULL`,
    ).get(monitorId, sinceMs) as { avg: number | null; min: number | null; max: number | null } | undefined;

    // P95 — get all latencies and find the 95th percentile
    const latencies = prep<[string, number]>(
      `SELECT latency_ms FROM uptime_history
       WHERE monitor_id = ? AND ts >= ? AND latency_ms IS NOT NULL
       ORDER BY latency_ms ASC`,
    ).all(monitorId, sinceMs) as Array<{ latency_ms: number }>;

    let p95: number | null = null;
    if (latencies.length > 0) {
      const idx = Math.ceil(latencies.length * 0.95) - 1;
      p95 = latencies[idx]?.latency_ms ?? null;
    }

    return {
      avg: row?.avg != null ? Math.round(row.avg) : null,
      p95,
      min: row?.min ?? null,
      max: row?.max ?? null,
    };
  },

  /** Get time-bucketed status for the status bar visualization. */
  statusBar(monitorId: string, buckets: number, rangeSinceMs: number): Array<{ ts: number; ok: boolean; latency: number | null }> {
    const now = Date.now();
    const bucketSize = (now - rangeSinceMs) / buckets;
    const checks = prep<[string, number]>(
      "SELECT ts, ok, latency_ms FROM uptime_history WHERE monitor_id = ? AND ts >= ? ORDER BY ts ASC",
    ).all(monitorId, rangeSinceMs) as Array<{ ts: number; ok: number; latency_ms: number | null }>;

    const result: Array<{ ts: number; ok: boolean; latency: number | null }> = [];
    for (let i = 0; i < buckets; i++) {
      const bucketStart = rangeSinceMs + i * bucketSize;
      const bucketEnd = bucketStart + bucketSize;
      const inBucket = checks.filter((c) => c.ts >= bucketStart && c.ts < bucketEnd);
      if (inBucket.length === 0) {
        result.push({ ts: bucketStart, ok: true, latency: null });
      } else {
        const allOk = inBucket.every((c) => c.ok === 1);
        const avgLatency = inBucket.filter((c) => c.latency_ms != null).reduce((sum, c, _, arr) => sum + (c.latency_ms ?? 0) / arr.length, 0);
        result.push({ ts: bucketStart, ok: allOk, latency: avgLatency > 0 ? Math.round(avgLatency) : null });
      }
    }
    return result;
  },

  // ── Incidents ───────────────────────────────────────────────────────────────

  /** Get the active (unresolved) incident for a monitor. */
  activeIncident(monitorId: string): UptimeIncidentRow | null {
    const row = prep<[string]>(
      "SELECT * FROM uptime_incidents WHERE monitor_id = ? AND resolved_at IS NULL ORDER BY started_at DESC LIMIT 1",
    ).get(monitorId);
    return (row as UptimeIncidentRow) ?? null;
  },

  /** Open a new incident. */
  openIncident(entry: { workspaceId: string; monitorId: string; cause?: string }): UptimeIncidentRow {
    const id = randomUUID();
    const now = Date.now();
    prep<[string, string, string, number, string | null, number]>(
      `INSERT INTO uptime_incidents (id, workspace_id, monitor_id, started_at, cause, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, entry.workspaceId, entry.monitorId, now, entry.cause ?? null, now);
    return prep<[string]>("SELECT * FROM uptime_incidents WHERE id = ?").get(id) as UptimeIncidentRow;
  },

  /** Resolve an active incident. */
  resolveIncident(monitorId: string): void {
    const now = Date.now();
    prep<[number, string]>(
      "UPDATE uptime_incidents SET resolved_at = ? WHERE monitor_id = ? AND resolved_at IS NULL",
    ).run(now, monitorId);
  },

  /** Increment failure count on the active incident. */
  incrementIncidentFailures(monitorId: string): void {
    prep<[string]>(
      "UPDATE uptime_incidents SET checks_failed = checks_failed + 1 WHERE monitor_id = ? AND resolved_at IS NULL",
    ).run(monitorId);
  },

  /** Recent incidents for a monitor. */
  recentIncidents(monitorId: string, limit = 10): UptimeIncidentRow[] {
    return prep<[string, number]>(
      "SELECT * FROM uptime_incidents WHERE monitor_id = ? ORDER BY started_at DESC LIMIT ?",
    ).all(monitorId, limit) as UptimeIncidentRow[];
  },

  /** All incidents for a workspace. */
  workspaceIncidents(workspaceId: string, limit = 50): UptimeIncidentRow[] {
    return prep<[string, number]>(
      "SELECT * FROM uptime_incidents WHERE workspace_id = ? ORDER BY started_at DESC LIMIT ?",
    ).all(workspaceId, limit) as UptimeIncidentRow[];
  },

  // ── Aggregate Stats ─────────────────────────────────────────────────────────

  /** Build comprehensive stats for a single monitor. */
  getMonitorStats(monitorId: string): MonitorStats | null {
    const monitor = this.getMonitor(monitorId);
    if (!monitor) return null;

    const now = Date.now();
    const h24 = now - 24 * 60 * 60 * 1000;
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;

    const lastCheckRow = this.lastCheck(monitorId);
    const up24 = this.uptimePercentage(monitorId, h24);
    const up7 = this.uptimePercentage(monitorId, d7);
    const up30 = this.uptimePercentage(monitorId, d30);
    const latency = this.latencyStats(monitorId, h24);
    const bar = this.statusBar(monitorId, 90, h24);
    const incident = this.activeIncident(monitorId);
    const incidents = this.recentIncidents(monitorId, 10);

    let currentStatus: "up" | "down" | "unknown" = "unknown";
    if (lastCheckRow) {
      currentStatus = lastCheckRow.ok === 1 ? "up" : "down";
    }

    return {
      monitor,
      lastCheck: lastCheckRow,
      currentStatus,
      uptime24h: up24.pct,
      uptime7d: up7.pct,
      uptime30d: up30.pct,
      avgLatency24h: latency.avg,
      statusBar: bar,
      totalChecks24h: up24.total,
      successChecks24h: up24.success,
      activeIncident: incident,
      recentIncidents: incidents,
      p95Latency24h: latency.p95,
      minLatency24h: latency.min,
      maxLatency24h: latency.max,
      certExpiryDays: null, // populated by the checker for HTTPS targets
    };
  },

  /** Build stats for all monitors in a workspace. */
  getWorkspaceStats(workspaceId: string): MonitorStats[] {
    const monitors = this.listMonitors(workspaceId);
    return monitors.map((m) => this.getMonitorStats(m.id)!).filter(Boolean);
  },

  /** Overview summary numbers for the dashboard. */
  workspaceSummary(workspaceId: string): {
    total: number;
    up: number;
    down: number;
    paused: number;
    avgUptime24h: number;
  } {
    const monitors = this.listMonitors(workspaceId);
    let up = 0;
    let down = 0;
    let paused = 0;
    let uptimeSum = 0;
    let uptimeCount = 0;

    for (const m of monitors) {
      if (!m.enabled) {
        paused++;
        continue;
      }
      const last = this.lastCheck(m.id);
      if (!last) continue;
      if (last.ok === 1) up++;
      else down++;

      const h24 = Date.now() - 24 * 60 * 60 * 1000;
      const pct = this.uptimePercentage(m.id, h24);
      uptimeSum += pct.pct;
      uptimeCount++;
    }

    return {
      total: monitors.length,
      up,
      down,
      paused,
      avgUptime24h: uptimeCount > 0 ? uptimeSum / uptimeCount : 100,
    };
  },

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  /** Prune old history rows (keeps last N days). */
  pruneHistory(olderThanDays = 90): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const result = getDb()
      .prepare("DELETE FROM uptime_history WHERE ts < ?")
      .run(cutoff);
    return result.changes;
  },
};
