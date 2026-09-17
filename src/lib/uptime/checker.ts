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
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { uptimeRepo, type UptimeMonitorRow } from "@/lib/db/repos/uptime";
import { parseHttpUrl, parseTcpTarget, resolveSafeHost, validateMonitorTarget } from "@/lib/uptime/validation";
import { connect as tlsConnect } from "node:tls";
import { dispatchNotification } from "@/lib/notifications/dispatcher";

const execFileAsync = promisify(execFile);

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
      if (monitor.headers_json.length > 512 * 1024) throw new Error("Invalid HTTP headers");
      let parsed: unknown;
      try { parsed = JSON.parse(monitor.headers_json); } catch { throw new Error("Invalid HTTP headers"); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid HTTP headers");
      const entries = Object.entries(parsed);
      if (entries.length > 50 || entries.some(([key, value]) => typeof value !== "string" || key.length > 256 || value.length > 8192)) throw new Error("Invalid HTTP headers");
      Object.assign(headers, parsed);
    }

    let target = parseHttpUrl(monitor.target);
    await validateMonitorTarget("http", target.toString());
    let statusCode: number;
    for (let redirects = 0; ; redirects++) {
      const result = await requestValidatedUrl(target, {
        method: monitor.method ?? "GET",
        headers,
        body: monitor.method && ["POST", "PUT", "PATCH"].includes(monitor.method) ? monitor.body : undefined,
        signal: controller.signal,
      });
      statusCode = result.statusCode;
      if (![301, 302, 303, 307, 308].includes(statusCode)) break;
      if (redirects >= 5) throw new Error("Too many redirects");
      const location = result.location;
      if (!location) break;
      target = parseHttpUrl(new URL(location, target).toString());
      await validateMonitorTarget("http", target.toString());
    }

    const latencyMs = Math.round(performance.now() - start);

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
    const message = err instanceof Error ? err.message : "check failed";
    const isTimeout = message.includes("abort") || message.includes("timeout");
    return {
      ok: false,
      latencyMs,
      error: isTimeout ? `Timeout after ${monitor.timeout_ms}ms` : message.startsWith("Unsafe") || message.startsWith("Invalid") || message.includes("redirect") ? message : "HTTP check failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

interface ValidatedRequestOptions {
  method: string;
  headers: Record<string, string>;
  body?: string | null;
  signal: AbortSignal;
}

async function requestValidatedUrl(
  target: URL,
  options: ValidatedRequestOptions,
): Promise<{ statusCode: number; location?: string }> {
  const address = await resolveSafeHost(target.hostname);
  const request = target.protocol === "https:" ? httpsRequest : httpRequest;

  return await new Promise((resolve, reject) => {
    const req = request(target, {
      method: options.method,
      headers: options.headers,
      signal: options.signal,
      lookup: (_hostname, _options, callback) => callback(null, address, address.includes(":") ? 6 : 4),
      ...(target.protocol === "https:" ? { servername: target.hostname } : {}),
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;
      response.resume();
      resolve({ statusCode, location });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ─── TCP Check ────────────────────────────────────────────────────────────────

function checkTcp(monitor: UptimeMonitorRow): Promise<CheckResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    let host: string;
    let port: number;
    try { ({ host, port } = parseTcpTarget(monitor.target)); }
    catch { resolve({ ok: false, latencyMs: 0, error: "Invalid TCP target" }); return; }
    let settled = false;
    let socket: Socket | null = null;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket?.destroy();
        resolve({
          ok: false,
          latencyMs: Math.round(performance.now() - start),
          error: `TCP timeout after ${monitor.timeout_ms}ms`,
        });
      }
    }, monitor.timeout_ms);

    void resolveSafeHost(host).then((address) => {
    if (settled) return;
    socket = createConnection({ host: address, port }, () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        const latencyMs = Math.round(performance.now() - start);
        socket?.destroy();
        resolve({ ok: true, latencyMs });
      }
    });

    socket.on("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          ok: false,
          latencyMs: Math.round(performance.now() - start),
          error: "TCP connection failed",
        });
      }
    });
    }).catch(() => resolve({ ok: false, latencyMs: Math.round(performance.now() - start), error: "Invalid or unsafe TCP target" }));
  });
}

// ─── Ping Check ───────────────────────────────────────────────────────────────

async function checkPing(monitor: UptimeMonitorRow): Promise<CheckResult> {
  const start = performance.now();
  const timeoutSec = Math.ceil(monitor.timeout_ms / 1000);

  try {
    await validateMonitorTarget("ping", monitor.target);
    const { stdout } = await execFileAsync("ping", ["-c", "1", "--", monitor.target], { timeout: monitor.timeout_ms + 2000, maxBuffer: 16 * 1024 });
    const latencyMs = Math.round(performance.now() - start);

    // Extract RTT from ping output
    const rttMatch = /time[=<](\d+(?:\.\d+)?)/.exec(stdout);
    const rtt = rttMatch ? Math.round(parseFloat(rttMatch[1])) : latencyMs;

    return { ok: true, latencyMs: rtt };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : "ping failed";
    return {
      ok: false,
      latencyMs,
      error: message.includes("timeout") ? `Ping timeout after ${timeoutSec}s` : "Ping failed",
    };
  }
}

// ─── TLS Certificate Expiry ───────────────────────────────────────────────────

async function getCertExpiry(url: string): Promise<number | null> {
  try {
    const parsed = parseHttpUrl(url);
    const address = await resolveSafeHost(parsed.hostname);
    return await new Promise<number | null>((resolve) => {
      const socket = tlsConnect({ host: address, port: Number(parsed.port) || 443, servername: parsed.hostname, rejectUnauthorized: false, timeout: 5000 }, () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        const expiry = cert.valid_to ? new Date(cert.valid_to).getTime() : NaN;
        resolve(Number.isFinite(expiry) ? Math.ceil((expiry - Date.now()) / 86400000) : null);
      });
      socket.on("error", () => resolve(null));
      socket.on("timeout", () => { socket.destroy(); resolve(null); });
    });
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
      void dispatchNotification(monitor.workspace_id, {
        type: "uptime.incident",
        title: `Service Outage: ${monitor.name}`,
        message: `Endpoint ${monitor.target} failed health check: ${result.error ?? `Status ${result.statusCode ?? "error"}`}`,
        severity: "critical",
        details: {
          Monitor: monitor.name,
          Target: monitor.target,
          Status: result.statusCode ?? "Connection Error",
          Error: result.error ?? "Health check failed",
          Time: new Date().toISOString(),
        },
      });
    }
  } else if (activeIncident) {
    // Was down, now up — resolve incident
    uptimeRepo.resolveIncident(monitor.id);
    console.log(
      `[uptime] ✓ INCIDENT RESOLVED: ${monitor.name} (${monitor.target}) — back up after ${activeIncident.checks_failed} failed checks`,
    );
    void dispatchNotification(monitor.workspace_id, {
      type: "uptime.incident",
      title: `Service Recovered: ${monitor.name}`,
      message: `Endpoint ${monitor.target} is back online after ${activeIncident.checks_failed} failed checks.`,
      severity: "resolved",
      details: {
        Monitor: monitor.name,
        Target: monitor.target,
        Latency: `${result.latencyMs}ms`,
        FailedChecks: activeIncident.checks_failed,
        Duration: `${Math.round((Date.now() - activeIncident.started_at) / 1000)}s`,
        Time: new Date().toISOString(),
      },
    });
  }
}

// ─── Background Scheduler ─────────────────────────────────────────────────────

const nextRun = new Map<string, number>();
let running = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let startupHandle: ReturnType<typeof setTimeout> | null = null;
let pruneHandle: ReturnType<typeof setInterval> | null = null;
let tickRunning = false;
let activeTick: Promise<void> | null = null;

function scheduleTick(): void {
  if (tickRunning) return;
  activeTick = tick().catch((err) => {
    console.error("[uptime] scheduler tick failed", err instanceof Error ? err.message : "unknown error");
  });
}

/** Tick runs every 5 seconds and fires any monitor whose next run time has passed. */
async function tick(): Promise<void> {
  if (!running || tickRunning) return;
  tickRunning = true;
  try {

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
  } finally {
    tickRunning = false;
  }
}

/** Start the uptime checker background loop. */
export function startUptimeChecker(): void {
  if (running) return;
  running = true;

  console.log("[uptime] background checker started (tick every 5s)");

  // Run first tick after a short delay to let the server settle
  startupHandle = setTimeout(() => {
    startupHandle = null;
    scheduleTick();
    intervalHandle = setInterval(scheduleTick, 5000);
  }, 3000);

  // Periodic history cleanup (once per day)
  pruneHandle = setInterval(() => {
    const pruned = uptimeRepo.pruneHistory(90);
    if (pruned > 0) {
      console.log(`[uptime] pruned ${pruned} history rows older than 90 days`);
    }
  }, 24 * 60 * 60 * 1000);
}

/** Stop the background checker (for shutdown). */
export async function stopUptimeChecker(): Promise<void> {
  running = false;
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (startupHandle) {
    clearTimeout(startupHandle);
    startupHandle = null;
  }
  if (pruneHandle) {
    clearInterval(pruneHandle);
    pruneHandle = null;
  }
  nextRun.clear();
  await activeTick;
  console.log("[uptime] background checker stopped");
}

/** Manually trigger a single check (for the "check now" button). */
export async function runManualCheck(monitorId: string, workspaceId: string): Promise<CheckResult> {
  const monitor = uptimeRepo.getMonitor(monitorId, workspaceId);
  if (!monitor) throw new Error("Monitor not found");

  const result = await runCheck(monitor);
  handleCheckResult(monitor, result);

  // Reset the schedule so we don't double-check
  nextRun.set(monitorId, Date.now() + monitor.interval_sec * 1000);

  return result;
}
