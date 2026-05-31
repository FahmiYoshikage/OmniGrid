import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTailnet } from "@/lib/tailscale/client";
import { getCloudflareOverview } from "@/lib/cloudflare/client";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { auditRepo } from "@/lib/db/repos/audit";
import { integrationSettingsRepo } from "@/lib/db/repos/integration-settings";
import { uptimeRepo } from "@/lib/db/repos/uptime";
import { requireSessionUser } from "@/lib/auth/access";
import { DashboardOnboarding } from "./dashboard-onboarding";
import { Activity, ArrowUpRight, Cloud, Globe, Network, ScrollText, Server, Settings } from "lucide-react";
import Link from "next/link";

export async function DashboardOverview({ showOnboarding = false }: { showOnboarding?: boolean }) {
  const user = await requireSessionUser();
  const cloudflareSettings = integrationSettingsRepo.getCloudflarePublic(user.workspaceId);
  const [snapshot, cloudflareOverview] = await Promise.all([
    getTailnet({ workspaceId: user.workspaceId }).catch(() => null),
    cloudflareSettings.accountId && cloudflareSettings.hasApiToken
      ? getCloudflareOverview(user.workspaceId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const localNodes = nodesRepo.list(user.workspaceId);
  const audits = auditRepo.recent(5, user.workspaceId);

  const online = snapshot?.devices.filter((d) => d.online).length ?? 0;
  const total = snapshot?.devices.length ?? 0;
  const publishedCount = cloudflareOverview?.tunnels.reduce((count, tunnel) => count + tunnel.hostnames.length, 0) ?? 0;
  const cloudflareReady = Boolean(cloudflareSettings.accountId && cloudflareSettings.hasApiToken);
  const uptimeSummary = uptimeRepo.workspaceSummary(user.workspaceId);

  return (
    <div className="flex min-h-full flex-col">
      <DashboardOnboarding open={showOnboarding} />
      <PageHeader
        title="Overview"
        description="Health snapshot of your tailnet, fleet, and recent activity."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {snapshot ? <Badge variant="default">Tailscale API</Badge> : null}
            {cloudflareReady ? <Badge variant="secondary">Cloudflare API</Badge> : null}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 p-8 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={<Network className="h-4 w-4" />} label="Tailnet devices" value={snapshot ? `${online} / ${total}` : "—"} hint={snapshot ? "online / total" : "Configure in Settings"} />
        <StatCard icon={<Server className="h-4 w-4" />} label="Managed nodes" value={String(localNodes.length)} hint="entries in OmniGrid Network Architecture DB" />
        <StatCard icon={<Cloud className="h-4 w-4" />} label="Cloudflare hostnames" value={cloudflareReady ? String(publishedCount) : "—"} hint={cloudflareReady ? "published through tunnels" : "Connect Cloudflare API"} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Uptime monitors" value={uptimeSummary.total > 0 ? `${uptimeSummary.up} / ${uptimeSummary.total}` : "—"} hint={uptimeSummary.total > 0 ? `${uptimeSummary.avgUptime24h.toFixed(1)}% avg 24h` : "Add monitors"} />
        <StatCard icon={<ScrollText className="h-4 w-4" />} label="Audit events" value={String(audits.length)} hint="last 5" />
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 pb-8 xl:grid-cols-2 2xl:grid-cols-4">
        <Card className="overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScrollText className="h-4 w-4 text-cyan-200" />
              Recent audit log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet. SSH sessions and runbook runs will appear here.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {audits.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">{new Date(a.ts).toLocaleTimeString()}</span>
                    <Badge variant="outline">{a.action}</Badge>
                    <span className="text-muted-foreground">{a.actor}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Network className="h-4 w-4 text-emerald-200" />
              Tailnet preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!snapshot ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/5 bg-black/20 p-6 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Tailscale not configured</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add your Tailscale API key and tailnet in Settings to see your devices here.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300/15 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/25"
                >
                  <Settings className="h-3 w-3" />
                  Go to Settings
                </Link>
              </div>
            ) : (
              <ul className="space-y-1 text-sm">
                {snapshot.devices.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
                    <span className={"inline-block h-2 w-2 rounded-full " + (d.online ? "bg-emerald-500" : "bg-zinc-500")} />
                    <span className="flex-1">{d.shortName}</span>
                    <span className="text-muted-foreground">{d.os}</span>
                    <span className="text-muted-foreground">{d.tailscaleIp}</span>
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-orange-200" />
              Cloudflare summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!cloudflareReady ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/5 bg-black/20 p-6 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-400/10 text-orange-200">
                  <Cloud className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Cloudflare monitoring not configured</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Save your Cloudflare Account ID and API token in Settings to surface tunnel and domain visibility here.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-300/15 px-4 py-2 text-xs font-medium text-orange-200 transition hover:bg-orange-300/25"
                >
                  <Settings className="h-3 w-3" />
                  Configure Cloudflare
                </Link>
              </div>
            ) : cloudflareOverview ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Tunnels" value={String(cloudflareOverview.tunnels.length)} />
                  <MiniStat label="Published" value={String(publishedCount)} />
                  <MiniStat label="Access apps" value={String(cloudflareOverview.accessApps.length)} />
                </div>
                {publishedCount > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {cloudflareOverview.tunnels.flatMap((tunnel) => tunnel.hostnames.map((hostname) => ({ tunnel: tunnel.name, ...hostname }))).slice(0, 5).map((item) => (
                      <li key={`${item.tunnel}-${item.hostname}`} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-white">{item.hostname}</span>
                          <Badge variant="outline">{item.tunnel}</Badge>
                        </div>
                        <div className="mt-1 break-all font-mono text-[11px] text-cyan-100/70">{item.service}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No published hostnames detected yet.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Cloudflare overview could not be loaded right now.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-purple-300" />
              Uptime monitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {uptimeSummary.total === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/5 bg-black/20 p-6 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-400/10 text-purple-200">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">No monitors added</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create your first monitor to start tracking service health.
                  </p>
                </div>
                <Link
                  href="/uptime"
                  className="inline-flex items-center gap-2 rounded-2xl bg-purple-400/15 px-4 py-2 text-xs font-medium text-purple-300 transition hover:bg-purple-400/25"
                >
                  <Activity className="h-3 w-3" />
                  Go to Uptime
                </Link>
              </div>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {uptimeRepo.listMonitors(user.workspaceId).slice(0, 6).map((monitor) => {
                  const stats = uptimeRepo.getMonitorStats(monitor.id);
                  if (!stats) return null;
                  const isUp = stats.currentStatus === "up";
                  const isDown = stats.currentStatus === "down";
                  return (
                    <li key={monitor.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isUp ? "bg-emerald-500 shadow-emerald-500/50" : isDown ? "bg-red-500 animate-pulse shadow-red-500/50" : "bg-zinc-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-xs truncate">{monitor.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{monitor.target}</div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className={`text-xs font-semibold ${stats.uptime24h >= 99 ? "text-emerald-400" : stats.uptime24h >= 95 ? "text-yellow-400" : "text-red-400"}`}>
                          {stats.uptime24h.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-muted-foreground">{stats.avgLatency24h != null ? `${stats.avgLatency24h}ms` : "-"}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="group overflow-hidden border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-cyan-300/30">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-100 transition-colors group-hover:bg-cyan-300/15">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
