"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Cloud,
  ExternalLink,
  Globe,
  KeyRound,
  Layers3,
  Network,
  PlusCircle,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CloudflareOverview } from "@/lib/cloudflare/types";

interface TunnelsClientProps {
  settings: {
    accountId: string;
    hasTunnelToken: boolean;
    hasApiToken: boolean;
    updatedAt: number | null;
  };
  publicOrigin: string;
  publicHost: string;
  zoneHint: string;
  readiness: {
    account: boolean;
    tunnelToken: boolean;
    apiToken: boolean;
    publicUrl: boolean;
  };
  readyCount: number;
}

export function TunnelsClient({ settings, publicOrigin, publicHost, zoneHint, readiness, readyCount }: TunnelsClientProps) {
  const [overview, setOverview] = useState<CloudflareOverview | null>(null);
  const [loading, setLoading] = useState(readiness.account && readiness.apiToken);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTunnelId, setSelectedTunnelId] = useState("");
  const [hostname, setHostname] = useState(publicHost.includes(":") ? publicHost.split(":")[0] : publicHost);
  const [service, setService] = useState("http://omnigrid:3000");
  const [path, setPath] = useState("");

  const publishedHostnames = useMemo(
    () =>
      overview?.tunnels.flatMap((tunnel) =>
        tunnel.hostnames.map((entry) => ({
          tunnelId: tunnel.id,
          tunnelName: tunnel.name,
          status: tunnel.status,
          hostname: entry.hostname,
          service: entry.service,
        })),
      ) ?? [],
    [overview],
  );

  const totals = useMemo(() => {
    const zoneCount = overview?.zones.length ?? 0;
    const dnsCount = overview?.zones.reduce((count, zone) => count + zone.dnsRecords.length, 0) ?? 0;
    return {
      tunnels: overview?.tunnels.length ?? 0,
      published: publishedHostnames.length,
      accessApps: overview?.accessApps.length ?? 0,
      zones: zoneCount,
      dns: dnsCount,
    };
  }, [overview, publishedHostnames.length]);

  async function loadOverview(showToast = false) {
    if (!readiness.account || !readiness.apiToken) {
      setLoading(false);
      setOverview(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cloudflare/overview", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { overview?: CloudflareOverview; error?: string };
      if (!res.ok || !data.overview) {
        throw new Error(data.error || "Failed to load Cloudflare overview");
      }
      setOverview(data.overview);
      if (showToast) toast.success("Cloudflare overview refreshed");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load Cloudflare overview";
      setError(message);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [readiness.account, readiness.apiToken]);

  useEffect(() => {
    if (!overview?.tunnels.length) {
      setSelectedTunnelId("");
      return;
    }
    if (!selectedTunnelId || !overview.tunnels.some((tunnel) => tunnel.id === selectedTunnelId)) {
      setSelectedTunnelId(overview.tunnels[0].id);
    }
  }, [overview, selectedTunnelId]);

  async function publishHostname(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTunnelId || !hostname.trim() || !service.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/cloudflare/published-apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tunnelId: selectedTunnelId,
          hostname: hostname.trim(),
          service: service.trim(),
          path: path.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        result?: { hostname: string; dnsRecordStatus: string };
        error?: string;
      };
      if (!res.ok || !data.result) {
        throw new Error(data.error || "Failed to publish hostname");
      }
      toast.success(`Published ${data.result.hostname} (${data.result.dnsRecordStatus} DNS)`);
      setPath("");
      await loadOverview();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to publish hostname");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/10 bg-gradient-to-br from-orange-400/10 to-cyan-400/5 shadow-2xl shadow-black/10">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-emerald-200" /> Cloudflare readiness
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Workspace-scoped status for monitoring tunnels, DNS, published hostnames, and Access apps.
              </p>
            </div>
            <Badge variant={readyCount === 4 ? "default" : "secondary"}>{readyCount}/4 ready</Badge>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadinessTile label="Account ID" value={settings.accountId || "Missing"} ready={readiness.account} icon={Cloud} />
            <ReadinessTile label="Tunnel token" value={settings.hasTunnelToken ? "Saved" : "Missing"} ready={readiness.tunnelToken} icon={KeyRound} />
            <ReadinessTile label="API token" value={settings.hasApiToken ? "Saved" : "Missing"} ready={readiness.apiToken} icon={Network} />
            <ReadinessTile label="Public origin" value={publicOrigin} ready={readiness.publicUrl} icon={ExternalLink} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PlusCircle className="h-4 w-4 text-cyan-200" /> Publish hostname from OmniGrid
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Add or update a public hostname on a remote-managed tunnel and sync the matching CNAME when possible.
              </p>
            </div>
            <Button variant="outline" onClick={() => void loadOverview(true)} disabled={loading || !readiness.account || !readiness.apiToken}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={publishHostname}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Tunnel">
                  <Select value={selectedTunnelId} onValueChange={(value) => setSelectedTunnelId(value ?? "") }>
                    <SelectTrigger className="w-full bg-white/[0.04]">
                      <SelectValue placeholder={overview?.tunnels.length ? "Select tunnel" : "No tunnel available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(overview?.tunnels ?? []).map((tunnel) => (
                        <SelectItem key={tunnel.id} value={tunnel.id}>
                          {tunnel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Hostname">
                  <Input value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder={`app.${zoneHint}`} className="bg-white/[0.04]" />
                </Field>
                <Field label="Origin service">
                  <Input value={service} onChange={(event) => setService(event.target.value)} placeholder="http://omnigrid:3000" className="bg-white/[0.04]" />
                </Field>
                <Field label="Optional path suffix">
                  <Input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/dashboard" className="bg-white/[0.04]" />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
                <span>DNS target will point to `&lt;tunnel-id&gt;.cfargotunnel.com` when the zone is visible to the API token.</span>
                <Button type="submit" disabled={submitting || loading || !selectedTunnelId || !hostname.trim() || !service.trim() || !readiness.apiToken}>
                  {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Publish hostname
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {!readiness.account || !readiness.apiToken ? (
        <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="text-base">Monitoring needs Cloudflare API token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>To monitor tunnels, published hostnames, Access apps, zones, and DNS records, save both your Cloudflare Account ID and API token in Settings.</p>
            <p>Recommended permissions: <code className="text-cyan-200/80">Cloudflare Tunnel:Read/Edit</code>, <code className="text-cyan-200/80">Access: Apps and Policies Read</code>, <code className="text-cyan-200/80">Zone:Read</code>, and <code className="text-cyan-200/80">DNS:Read/Edit</code>.</p>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-500/20 bg-red-500/5 shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="text-base text-red-100">Cloudflare API error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-red-100/80">
            <p>{error}</p>
            <p>Biasanya ini berarti permission token belum cukup, account ID salah, atau endpoint Zero Trust belum tersedia di akun tersebut.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Server} label="Tunnels" value={loading ? "—" : String(totals.tunnels)} hint="remote-managed tunnels" />
        <StatCard icon={Globe} label="Published hostnames" value={loading ? "—" : String(totals.published)} hint="ingress hostname rules" />
        <StatCard icon={ShieldCheck} label="Access apps" value={loading ? "—" : String(totals.accessApps)} hint="Zero Trust applications" />
        <StatCard icon={Layers3} label="Zones" value={loading ? "—" : String(totals.zones)} hint="domains visible to token" />
        <StatCard icon={Network} label="DNS CNAME records" value={loading ? "—" : String(totals.dns)} hint="proxied hostnames" />
      </div>

      {overview?.warnings.length ? (
        <Card className="border-amber-400/20 bg-amber-400/5 shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="text-base text-amber-100">Partial visibility warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-50/80">
            {overview.warnings.map((warning) => (
              <div key={warning} className="rounded-2xl border border-amber-300/10 bg-black/20 px-3 py-2">
                {warning}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="tunnels" className="gap-4">
        <TabsList variant="line" className="border border-white/10 bg-white/[0.03] p-1">
          <TabsTrigger value="tunnels">Tunnels</TabsTrigger>
          <TabsTrigger value="published">Published hostnames</TabsTrigger>
          <TabsTrigger value="zones">Zones & DNS</TabsTrigger>
          <TabsTrigger value="access">Access apps</TabsTrigger>
        </TabsList>

        <TabsContent value="tunnels">
          <div className="grid gap-4 xl:grid-cols-2">
            {(overview?.tunnels ?? []).map((tunnel) => (
              <Card key={tunnel.id} className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{tunnel.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{tunnel.id}</p>
                  </div>
                  <Badge variant={tunnel.status.toLowerCase().includes("healthy") ? "default" : "secondary"}>{tunnel.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoRow label="Created" value={formatDateTime(tunnel.createdAt)} />
                    <InfoRow label="Last connected" value={formatDateTime(tunnel.lastConnectedAt)} />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">Published hostnames</div>
                    {tunnel.hostnames.length ? (
                      <div className="space-y-2">
                        {tunnel.hostnames.map((entry) => (
                          <div key={`${tunnel.id}-${entry.hostname}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                            <div className="text-sm font-medium text-white">{entry.hostname}</div>
                            <div className="mt-1 break-all font-mono text-xs text-cyan-100/70">{entry.service}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No published hostnames found on this tunnel.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && !overview?.tunnels.length ? (
              <EmptyCard title="No tunnels found" body="Cloudflare returned no remote-managed tunnels for this account or your token cannot list them." />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="published">
          <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
            <CardHeader>
              <CardTitle className="text-base">Published hostname inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {publishedHostnames.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hostname</TableHead>
                      <TableHead>Tunnel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Service</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publishedHostnames.map((item) => (
                      <TableRow key={`${item.tunnelId}-${item.hostname}`}>
                        <TableCell className="font-medium">{item.hostname}</TableCell>
                        <TableCell>{item.tunnelName}</TableCell>
                        <TableCell>
                          <Badge variant={item.status.toLowerCase().includes("healthy") ? "default" : "secondary"}>{item.status}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xl break-all whitespace-normal font-mono text-xs text-cyan-100/80">{item.service}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No published hostnames detected yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zones">
          <div className="grid gap-4 xl:grid-cols-2">
            {(overview?.zones ?? []).map((zone) => (
              <Card key={zone.id} className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
                <CardHeader className="flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{zone.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{zone.id}</p>
                  </div>
                  <Badge variant={zone.status === "active" ? "default" : "secondary"}>{zone.status}</Badge>
                </CardHeader>
                <CardContent>
                  {zone.dnsRecords.length ? (
                    <div className="space-y-2">
                      {zone.dnsRecords.map((record) => (
                        <div key={record.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{record.type}</Badge>
                            <span className="text-sm font-medium">{record.name}</span>
                            {record.proxied ? <Badge variant="default">proxied</Badge> : <Badge variant="secondary">dns only</Badge>}
                          </div>
                          <div className="mt-2 break-all font-mono text-xs text-cyan-100/80">{record.content}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No CNAME records visible for this zone.</p>
                  )}
                </CardContent>
              </Card>
            ))}
            {!loading && !overview?.zones.length ? (
              <EmptyCard title="No zones visible" body="Your API token may only have account-level tunnel permissions and no zone read access." />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="access">
          <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Cloudflare Access applications</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Visible self-hosted or Zero Trust apps tied to this account.</p>
              </div>
              <a href="https://one.dash.cloudflare.com/" target="_blank" rel="noreferrer">
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open Zero Trust
                </Button>
              </a>
            </CardHeader>
            <CardContent>
              {overview?.accessApps.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.accessApps.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.name}</TableCell>
                        <TableCell>{app.domain}</TableCell>
                        <TableCell>{app.type}</TableCell>
                        <TableCell>{formatDateTime(app.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No Access applications were returned for this account.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReadinessTile({
  label,
  value,
  ready,
  icon: Icon,
}: {
  label: string;
  value: string;
  ready: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.05] text-cyan-100">
          <Icon className="h-4 w-4" />
        </div>
        <Badge variant={ready ? "default" : "secondary"}>{ready ? "Ready" : "Missing"}</Badge>
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className="mt-2 break-all text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
