"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import {
  Activity, AlertTriangle, ArrowUpRight, Check, ChevronDown, ChevronRight,
  Circle, Clock, ExternalLink, Globe, Loader2, Pause, Play, Plus,
  RefreshCw, Server, ShieldCheck, Signal, Trash2, Wifi, X, Zap,
} from "lucide-react";

/* ── types ─────────────────────────────────────────────────── */
interface MonitorStats {
  monitor: {
    id: string; name: string; kind: string; target: string;
    interval_sec: number; timeout_ms: number; method: string | null;
    expected_status: number | null; enabled: number; notify: number;
    created_at: number; updated_at: number;
    headers_json: string | null; body: string | null;
  };
  currentStatus: "up" | "down" | "unknown";
  uptime24h: number; uptime7d: number; uptime30d: number;
  avgLatency24h: number | null; p95Latency24h: number | null;
  minLatency24h: number | null; maxLatency24h: number | null;
  totalChecks24h: number; successChecks24h: number;
  lastCheck: { ts: number; ok: number; latency_ms: number | null; status_code: number | null; error: string | null } | null;
  statusBar: Array<{ ts: number; ok: boolean; latency: number | null }>;
  activeIncident: { id: string; started_at: number; cause: string | null; checks_failed: number } | null;
  recentIncidents: Array<{ id: string; started_at: number; resolved_at: number | null; cause: string | null; checks_failed: number }>;
  certExpiryDays: number | null;
}
interface Summary { total: number; up: number; down: number; paused: number; avgUptime24h: number }
type Kind = "http" | "tcp" | "ping";

const EMPTY_FORM = { name: "", kind: "http" as Kind, target: "", interval_sec: 60, timeout_ms: 10000, method: "GET", expected_status: null as number | null, enabled: true, notify: true };

/* ── main ──────────────────────────────────────────────────── */
export function UptimeClient() {
  const [monitors, setMonitors] = useState<MonitorStats[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, up: 0, down: 0, paused: 0, avgUptime24h: 100 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/uptime/monitors");
      if (!res.ok) return;
      const data = await res.json();
      setMonitors(data.monitors ?? []);
      setSummary(data.summary ?? { total: 0, up: 0, down: 0, paused: 0, avgUptime24h: 100 });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); const iv = setInterval(fetchData, 30000); return () => clearInterval(iv); }, [fetchData]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); };
  const openEdit = (s: MonitorStats) => {
    setForm({ name: s.monitor.name, kind: s.monitor.kind as Kind, target: s.monitor.target, interval_sec: s.monitor.interval_sec, timeout_ms: s.monitor.timeout_ms, method: s.monitor.method ?? "GET", expected_status: s.monitor.expected_status, enabled: s.monitor.enabled === 1, notify: s.monitor.notify === 1 });
    setEditId(s.monitor.id); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editId ? `/api/uptime/monitors/${editId}` : "/api/uptime/monitors";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { closeForm(); await fetchData(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this monitor and all its history?")) return;
    await fetch(`/api/uptime/monitors/${id}`, { method: "DELETE" });
    setExpanded(null); await fetchData();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/uptime/monitors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    await fetchData();
  };

  const handleCheckNow = async (id: string) => {
    setChecking(id);
    try {
      await fetch(`/api/uptime/monitors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check_now" }) });
      await fetchData();
    } finally { setChecking(null); }
  };

  const uptimeColor = (pct: number) => pct >= 99.9 ? "text-emerald-400" : pct >= 99 ? "text-green-400" : pct >= 95 ? "text-yellow-400" : "text-red-400";
  const statusDot = (s: string) => s === "up" ? "bg-emerald-500 shadow-emerald-500/50" : s === "down" ? "bg-red-500 shadow-red-500/50 animate-pulse" : "bg-zinc-500";
  const kindIcon = (k: string) => k === "http" ? <Globe className="h-4 w-4" /> : k === "tcp" ? <Server className="h-4 w-4" /> : <Signal className="h-4 w-4" />;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Uptime Monitoring" description="Real-time health monitoring for your services, APIs, and infrastructure endpoints." actions={
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
          <Plus className="h-4 w-4" /> New Monitor
        </button>
      } />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 p-8 md:grid-cols-5">
        <SummaryCard icon={<Activity className="h-4 w-4" />} label="Total monitors" value={String(summary.total)} />
        <SummaryCard icon={<Check className="h-4 w-4" />} label="Operational" value={String(summary.up)} color="text-emerald-400" />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Down" value={String(summary.down)} color={summary.down > 0 ? "text-red-400" : undefined} />
        <SummaryCard icon={<Pause className="h-4 w-4" />} label="Paused" value={String(summary.paused)} />
        <SummaryCard icon={<ShieldCheck className="h-4 w-4" />} label="Avg uptime 24h" value={`${summary.avgUptime24h.toFixed(2)}%`} color={uptimeColor(summary.avgUptime24h)} />
      </div>

      {/* Monitor List */}
      <div className="flex flex-col gap-3 px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>
        ) : monitors.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-12 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200"><Activity className="h-8 w-8" /></div>
            <div>
              <p className="text-lg font-medium text-white">No monitors configured</p>
              <p className="mt-1 text-sm text-muted-foreground">Add your first uptime monitor to start tracking service health.</p>
            </div>
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300/15 px-5 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-300/25">
              <Plus className="h-4 w-4" /> Create monitor
            </button>
          </div>
        ) : monitors.map((s) => {
          const isExpanded = expanded === s.monitor.id;
          return (
            <div key={s.monitor.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/10 transition-all hover:border-white/15">
              {/* Monitor Row */}
              <button onClick={() => setExpanded(isExpanded ? null : s.monitor.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                <span className={`h-3 w-3 shrink-0 rounded-full shadow-lg ${statusDot(s.currentStatus)}`} />
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-cyan-200">{kindIcon(s.monitor.kind)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">{s.monitor.name}</span>
                    {s.monitor.enabled === 0 && <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">PAUSED</span>}
                    {s.activeIncident && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300 animate-pulse">INCIDENT</span>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{s.monitor.target}</div>
                </div>
                {/* Status Bar mini */}
                <div className="hidden md:flex items-center gap-[2px]">
                  {s.statusBar.slice(-45).map((b, i) => (
                    <div key={i} className={`h-6 w-[3px] rounded-full ${b.latency === null ? "bg-zinc-700/50" : b.ok ? "bg-emerald-500/70" : "bg-red-500/80"}`} />
                  ))}
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 min-w-[90px]">
                  <span className={`text-sm font-semibold tabular-nums ${uptimeColor(s.uptime24h)}`}>{s.uptime24h.toFixed(2)}%</span>
                  <span className="text-[10px] text-muted-foreground">{s.avgLatency24h != null ? `${s.avgLatency24h}ms avg` : "no data"}</span>
                </div>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-white/10 bg-black/20 px-5 py-5">
                  {/* Actions */}
                  <div className="mb-5 flex flex-wrap gap-2">
                    <button onClick={() => handleCheckNow(s.monitor.id)} disabled={checking === s.monitor.id} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-300/15 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/25 disabled:opacity-50">
                      {checking === s.monitor.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Check Now
                    </button>
                    <button onClick={() => handleToggle(s.monitor.id, s.monitor.enabled === 0)} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/15">
                      {s.monitor.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />} {s.monitor.enabled ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => openEdit(s)} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/15">
                      <RefreshCw className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(s.monitor.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/25">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
                    <MiniStat label="Uptime 24h" value={`${s.uptime24h.toFixed(3)}%`} color={uptimeColor(s.uptime24h)} />
                    <MiniStat label="Uptime 7d" value={`${s.uptime7d.toFixed(3)}%`} color={uptimeColor(s.uptime7d)} />
                    <MiniStat label="Uptime 30d" value={`${s.uptime30d.toFixed(3)}%`} color={uptimeColor(s.uptime30d)} />
                    <MiniStat label="Checks 24h" value={`${s.successChecks24h}/${s.totalChecks24h}`} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
                    <MiniStat label="Avg latency" value={s.avgLatency24h != null ? `${s.avgLatency24h}ms` : "—"} />
                    <MiniStat label="P95 latency" value={s.p95Latency24h != null ? `${s.p95Latency24h}ms` : "—"} />
                    <MiniStat label="Min / Max" value={s.minLatency24h != null ? `${s.minLatency24h} / ${s.maxLatency24h}ms` : "—"} />
                    <MiniStat label="Interval" value={`${s.monitor.interval_sec}s`} />
                  </div>

                  {/* Status bar full */}
                  <div className="mb-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>24 hour status</span>
                      <span>{s.lastCheck ? `Last check: ${new Date(s.lastCheck.ts).toLocaleTimeString()}` : "No checks yet"}</span>
                    </div>
                    <div className="flex items-center gap-[2px] rounded-xl bg-black/30 p-2">
                      {s.statusBar.map((b, i) => (
                        <div key={i} className={`h-8 flex-1 rounded-sm transition-colors ${b.latency === null ? "bg-zinc-700/40" : b.ok ? "bg-emerald-500/70 hover:bg-emerald-400" : "bg-red-500/80 hover:bg-red-400"}`} title={b.latency != null ? `${new Date(b.ts).toLocaleTimeString()} — ${b.ok ? "OK" : "FAIL"} — ${b.latency}ms` : "No data"} />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>24h ago</span><span>Now</span>
                    </div>
                  </div>

                  {/* Active Incident */}
                  {s.activeIncident && (
                    <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-red-300">
                        <AlertTriangle className="h-4 w-4" /> Active Incident
                      </div>
                      <p className="mt-1 text-xs text-red-200/70">Started {new Date(s.activeIncident.started_at).toLocaleString()} — {s.activeIncident.checks_failed} failed checks</p>
                      {s.activeIncident.cause && <p className="mt-1 font-mono text-xs text-red-200/60">{s.activeIncident.cause}</p>}
                    </div>
                  )}

                  {/* Recent Incidents */}
                  {s.recentIncidents.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Incidents</h4>
                      <div className="space-y-1.5">
                        {s.recentIncidents.slice(0, 5).map((inc) => (
                          <div key={inc.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs">
                            <span className={`h-2 w-2 rounded-full ${inc.resolved_at ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`} />
                            <span className="flex-1 text-muted-foreground truncate">{inc.cause ?? "Unknown"}</span>
                            <span className="text-muted-foreground">{inc.checks_failed} fails</span>
                            <span className="text-muted-foreground">{new Date(inc.started_at).toLocaleDateString()}</span>
                            {inc.resolved_at ? (
                              <span className="text-emerald-400 text-[10px]">Resolved</span>
                            ) : (
                              <span className="text-red-400 text-[10px]">Ongoing</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last check error */}
                  {s.lastCheck?.error && (
                    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs font-medium text-amber-300">Last error</p>
                      <p className="mt-0.5 font-mono text-xs text-amber-200/70">{s.lastCheck.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editId ? "Edit Monitor" : "New Monitor"}</h2>
              <button onClick={closeForm} className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4">
              <FormField label="Name">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My API server" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-400/50" />
              </FormField>

              <FormField label="Type">
                <div className="flex gap-2">
                  {(["http", "tcp", "ping"] as Kind[]).map((k) => (
                    <button key={k} onClick={() => setForm({ ...form, kind: k })} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${form.kind === k ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}>
                      {k.toUpperCase()}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Target" hint={form.kind === "http" ? "https://example.com/health" : form.kind === "tcp" ? "host:port" : "hostname or IP"}>
                <input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder={form.kind === "http" ? "https://example.com" : form.kind === "tcp" ? "example.com:443" : "example.com"} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-400/50" />
              </FormField>

              {form.kind === "http" && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Method">
                    <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                      {["GET", "POST", "PUT", "HEAD", "OPTIONS"].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Expected status">
                    <input type="number" value={form.expected_status ?? ""} onChange={(e) => setForm({ ...form, expected_status: e.target.value ? Number(e.target.value) : null })} placeholder="Any 2xx" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-400/50" />
                  </FormField>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Interval (seconds)">
                  <input type="number" value={form.interval_sec} onChange={(e) => setForm({ ...form, interval_sec: Number(e.target.value) || 60 })} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
                </FormField>
                <FormField label="Timeout (ms)">
                  <input type="number" value={form.timeout_ms} onChange={(e) => setForm({ ...form, timeout_ms: Number(e.target.value) || 10000 })} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
                </FormField>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="rounded accent-cyan-400" /> Enabled
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input type="checkbox" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} className="rounded accent-cyan-400" /> Alerts
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeForm} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/10">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.target} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {editId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── small components ──────────────────────────────────────── */
function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-4 shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-cyan-300/30">
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-100">{icon}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${color ?? ""}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-semibold tabular-nums ${color ?? ""}`}>{value}</div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-400">{label}</label>
      {children}
      {hint && <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}
