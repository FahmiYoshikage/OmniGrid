/**
 * Uptime checker engine.
 *
 * Runs as a background loop in the custom server process. For each enabled
 * monitor it performs the appropriate check (HTTP / TCP / ICMP ping) at the
 * configured interval, records results, and manages incident lifecycle.
 *
 * Design decisions:
 *   - Single-process scheduler: no external cron or queue needed.
 *   - Per-monitor timer tracked via `nextRun` map to avoid drift.
 *   - All checks run with AbortController for hard timeout.
 *   - TLS certificate expiry is extracted for HTTPS targets.
 *   - Incidents are opened on first failure and resolved on first success.
 */

import { createConnection, type Socket } from "node:net";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { uptimeRepo, type UptimeMonitorRow } from "@/lib/db/repos/uptime";

const execAsync = promisify(exec);

export interface CheckResult {
  ok: boolean;
  statusCode?: number | null;
  latencyMs: number;
  error?: string | null;
  certExpiryDays?: number | null;
}

// ─── HTTP Check ───────────────────────────────────────────────────────────────

async function checkHttp(monitor: UptimeMonitorRow): Promise<CheckResult> {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), monitor.timeout_ms);

  try {
    const headers: Record<string, string> = {
      "User-Agent": "OmniGrid-Uptime/1.0",
    };
    if (monitor.headers_json) {
      try {
        Object.assign(headers, JSON.parse(monitor.headers_json));
      } catch {}
    }

    const res = await fetch(monitor.target, {
      method: monitor.method ?? "GET",
      headers,
      body: monitor.method && ["POST", "PUT", "PATCH"].includes(monitor.method) ? monitor.body : undefined,
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    const latencyMs = Math.round(performance.now() - start);
    const statusCode = res.status;

    // Determine success
    let ok: boolean;
    if (monitor.expected_status) {
      ok = statusCode === monitor.expected_status;
    } else {
      ok = statusCode >= 200 && statusCode < 400;
    }

    // TLS certificate expiry for HTTPS targets
    let certExpiryDays: number | null = null;
    if (monitor.target.startsWith("https://")) {
      certExpiryDays = await getCertExpiry(monitor.target).catch(() => null);
    }

    return { ok, statusCode, latencyMs, certExpiryDays };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes("abort") || message.includes("timeout");
    return {
      ok: false,
      latencyMs,
      error: isTimeout ? `Timeout after ${monitor.timeout_ms}ms` : message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── TCP Check ────────────────────────────────────────────────────────────────

function checkTcp(monitor: UptimeMonitorRow): Promise<CheckResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const [host, portStr] = monitor.target.split(":");
    const port = parseInt(portStr || "80", 10);
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({
          ok: false,
          latencyMs: Math.round(performance.now() - start),
          error: `TCP timeout after ${monitor.timeout_ms}ms`,
        });
      }
    }, monitor.timeout_ms);

    const socket: Socket = createConnection({ host, port }, () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        const latencyMs = Math.round(performance.now() - start);
        socket.destroy();
        resolve({ ok: true, latencyMs });
      }
    });

    socket.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          ok: false,
          latencyMs: Math.round(performance.now() - start),
          error: err.message,
        });
      }
    });
  });
}

// ─── Ping Check ───────────────────────────────────────────────────────────────

async function checkPing(monitor: UptimeMonitorRow): Promise<CheckResult> {
  const start = performance.now();
  const timeoutSec = Math.ceil(monitor.timeout_ms / 1000);
  const target = monitor.target.replace(/[^a-zA-Z0-9.\-:]/g, ""); // sanitize

  try {
    const { stdout } = await execAsync(
      `ping -c 1 ${target}`,
      { timeout: monitor.timeout_ms + 2000 },
    );
    const latencyMs = Math.round(performance.now() - start);

    // Extract RTT from ping output
    const rttMatch = /time[=<](\d+(?:\.\d+)?)/.exec(stdout);
    const rtt = rttMatch ? Math.round(parseFloat(rttMatch[1])) : latencyMs;

    return { ok: true, latencyMs: rtt };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      latencyMs,
      error: message.includes("timeout") ? `Ping timeout after ${timeoutSec}s` : `Ping failed: ${message.slice(0, 200)}`,
    };
  }
}

// ─── TLS Certificate Expiry ───────────────────────────────────────────────────

async function getCertExpiry(url: string): Promise<number | null> {
  try {
    const hostname = new URL(url).hostname;
    const { stdout } = await execAsync(
      `echo | openssl s_client -servername ${hostname} -connect ${hostname}:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null`,
      { timeout: 5000 },
    );
    const match = /notAfter=(.+)/.exec(stdout);
    if (!match) return null;
    const expiryDate = new Date(match[1].trim());
    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return daysLeft;
  } catch {
    return null;
  }
}

// ─── Check Dispatcher ─────────────────────────────────────────────────────────

async function runCheck(monitor: UptimeMonitorRow): Promise<CheckResult> {
  switch (monitor.kind) {
    case "http":
      return checkHttp(monitor);
    case "tcp":
      return checkTcp(monitor);
    case "ping":
      return checkPing(monitor);
    default:
      return { ok: false, latencyMs: 0, error: `Unknown monitor kind: ${monitor.kind}` };
  }
}

// ─── Incident Management ──────────────────────────────────────────────────────

function handleCheckResult(monitor: UptimeMonitorRow, result: CheckResult): void {
  // Record the check
  uptimeRepo.recordCheck({
    workspaceId: monitor.workspace_id,
    monitorId: monitor.id,
    ok: result.ok,
    statusCode: result.statusCode,
    latencyMs: result.latencyMs,
    error: result.error,
  });

  // Incident lifecycle
  const activeIncident = uptimeRepo.activeIncident(monitor.id);

  if (!result.ok) {
    if (activeIncident) {
      // Ongoing incident — increment failure count
      uptimeRepo.incrementIncidentFailures(monitor.id);
    } else {
      // New incident — open it
      uptimeRepo.openIncident({
        workspaceId: monitor.workspace_id,
        monitorId: monitor.id,
        cause: result.error ?? `Check failed (status ${result.statusCode ?? "unknown"})`,
      });
      console.log(
        `[uptime] ⚠ INCIDENT OPENED: ${monitor.name} (${monitor.target}) — ${result.error ?? "check failed"}`,
      );
    }
  } else if (activeIncident) {
    // Was down, now up — resolve incident
    uptimeRepo.resolveIncident(monitor.id);
    console.log(
      `[uptime] ✓ INCIDENT RESOLVED: ${monitor.name} (${monitor.target}) — back up after ${activeIncident.checks_failed} failed checks`,
    );
  }
}

// ─── Background Scheduler ─────────────────────────────────────────────────────

const nextRun = new Map<string, number>();
let running = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Tick runs every 5 seconds and fires any monitor whose next run time has passed. */
async function tick(): Promise<void> {
  if (!running) return;

  const monitors = uptimeRepo.listAllEnabled();
  const now = Date.now();

  const due = monitors.filter((m) => {
    const next = nextRun.get(m.id);
    if (!next) {
      // First run: stagger by a random delay within the interval to avoid thundering herd
      nextRun.set(m.id, now + Math.floor(Math.random() * Math.min(m.interval_sec * 1000, 15000)));
      return false;
    }
    return now >= next;
  });

  // Run checks concurrently (but with a concurrency limit)
  const CONCURRENCY = 10;
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const batch = due.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (monitor) => {
        try {
          const result = await runCheck(monitor);
          handleCheckResult(monitor, result);
        } catch (err) {
          console.error(`[uptime] check error for ${monitor.name}:`, err);
        } finally {
          // Schedule next run
          nextRun.set(monitor.id, Date.now() + monitor.interval_sec * 1000);
        }
      }),
    );
  }

  // Clean up nextRun entries for monitors that no longer exist
  const monitorIds = new Set(monitors.map((m) => m.id));
  for (const [id] of nextRun) {
    if (!monitorIds.has(id)) nextRun.delete(id);
  }
}

/** Start the uptime checker background loop. */
export function startUptimeChecker(): void {
  if (running) return;
  running = true;

  console.log("[uptime] background checker started (tick every 5s)");

  // Run first tick after a short delay to let the server settle
  setTimeout(() => {
    void tick();
    intervalHandle = setInterval(() => void tick(), 5000);
  }, 3000);

  // Periodic history cleanup (once per day)
  setInterval(() => {
    const pruned = uptimeRepo.pruneHistory(90);
    if (pruned > 0) {
      console.log(`[uptime] pruned ${pruned} history rows older than 90 days`);
    }
  }, 24 * 60 * 60 * 1000);
}

/** Stop the background checker (for shutdown). */
export function stopUptimeChecker(): void {
  running = false;
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  nextRun.clear();
  console.log("[uptime] background checker stopped");
}

/** Manually trigger a single check (for the "check now" button). */
export async function runManualCheck(monitorId: string): Promise<CheckResult> {
  const monitor = uptimeRepo.getMonitor(monitorId);
  if (!monitor) throw new Error("Monitor not found");

  const result = await runCheck(monitor);
  handleCheckResult(monitor, result);

  // Reset the schedule so we don't double-check
  nextRun.set(monitorId, Date.now() + monitor.interval_sec * 1000);

  return result;
}
