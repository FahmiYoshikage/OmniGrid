import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTailnet } from "@/lib/tailscale/client";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { auditRepo } from "@/lib/db/repos/audit";
import { Activity, Server, Network, ScrollText, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [snapshot] = await Promise.all([getTailnet().catch(() => null)]);
  const localNodes = nodesRepo.list();
  const audits = auditRepo.recent(5);

  const online = snapshot?.devices.filter((d) => d.online).length ?? 0;
  const total = snapshot?.devices.length ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Overview"
        description="Health snapshot of your tailnet, fleet, and recent activity."
        actions={
          snapshot && (
            <Badge variant={snapshot.source === "api" ? "default" : "secondary"}>
              {snapshot.source === "api" ? "Tailscale API" : "Mock data"}
            </Badge>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 p-8 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Network className="h-4 w-4" />}
          label="Tailnet devices"
          value={`${online} / ${total}`}
          hint="online / total"
        />
        <StatCard
          icon={<Server className="h-4 w-4" />}
          label="Managed nodes"
          value={String(localNodes.length)}
          hint="entries in OmniGrid DB"
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Uptime checks"
          value="—"
          hint="enabled in M8"
        />
        <StatCard
          icon={<ScrollText className="h-4 w-4" />}
          label="Audit events"
          value={String(audits.length)}
          hint="last 5"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 pb-8 lg:grid-cols-2">
        <Card className="overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScrollText className="h-4 w-4 text-cyan-200" />
              Recent audit log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No events yet. SSH sessions and runbook runs will appear here.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {audits.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">
                      {new Date(a.ts).toLocaleTimeString()}
                    </span>
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
              <p className="text-sm text-destructive">
                Failed to load Tailscale snapshot.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {snapshot.devices.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
                    <span
                      className={
                        "inline-block h-2 w-2 rounded-full " +
                        (d.online ? "bg-emerald-500" : "bg-zinc-500")
                      }
                    />
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
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="group overflow-hidden border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-cyan-300/30">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-100 transition-colors group-hover:bg-cyan-300/15">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
