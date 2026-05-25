import Link from "next/link";
import { Cloud, ExternalLink, Globe, KeyRound, ShieldCheck, CheckCircle2, CircleDashed, Server } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionUser } from "@/lib/auth/access";
import { integrationSettingsRepo } from "@/lib/db/repos/integration-settings";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function TunnelsPage() {
  const user = await requireSessionUser();
  const settings = integrationSettingsRepo.getCloudflarePublic(user.workspaceId);
  const env = getEnv();
  const publicUrl = env.OMNIGRID_PUBLIC_URL ? new URL(env.OMNIGRID_PUBLIC_URL) : null;
  const publicHost = publicUrl?.host ?? "your-domain.example.com";
  const publicOrigin = publicUrl?.origin ?? "https://your-domain.example.com";
  const readiness = {
    account: Boolean(settings.accountId.trim()),
    token: settings.hasTunnelToken,
    publicUrl: Boolean(publicUrl),
  };
  const readyCount = Object.values(readiness).filter(Boolean).length;
  const zoneHint = publicHost.includes(":") ? publicHost.split(":")[0] : publicHost;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Cloudflare Tunnel"
        description="Publish OmniGrid through Cloudflare Zero Trust without exposing inbound ports."
        actions={
          <Link href="/settings">
            <Button>
              <Cloud className="mr-2 h-4 w-4" /> Configure settings
            </Button>
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-white/10 bg-gradient-to-br from-orange-400/10 to-cyan-400/5 shadow-2xl shadow-black/10">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4 text-orange-200" /> Tunnel readiness
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Workspace-scoped setup status for Cloudflare Zero Trust.
                </p>
              </div>
              <Badge variant={readyCount === 3 ? "default" : "secondary"}>
                {readyCount}/3 ready
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <StatusTile
                label="Account ID"
                value={settings.accountId || "Not set"}
                ready={readiness.account}
                icon={Cloud}
              />
              <StatusTile
                label="Tunnel token"
                value={settings.hasTunnelToken ? "Saved securely" : "Missing"}
                ready={readiness.token}
                icon={KeyRound}
              />
              <StatusTile
                label="Public URL"
                value={publicOrigin}
                ready={readiness.publicUrl}
                icon={ExternalLink}
              />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-emerald-200" /> Why this path
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>Cloudflare Tunnel keeps OmniGrid private behind outbound-only connectivity.</p>
              <p>No public reverse proxy or inbound firewall opening is required on your Docker host.</p>
              <p>Cloudflare secrets stay scoped to the current workspace and remain encrypted at rest.</p>
              {settings.updatedAt && (
                <p className="text-xs">Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
            <CardHeader>
              <CardTitle className="text-base">Setup checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ChecklistItem
                label="Save Cloudflare Account ID in Settings"
                ready={readiness.account}
              />
              <ChecklistItem
                label="Save tunnel token in Settings"
                ready={readiness.token}
              />
              <ChecklistItem
                label="Set OMNIGRID_PUBLIC_URL to the final public hostname"
                ready={readiness.publicUrl}
              />
              <ChecklistItem
                label="Create a public hostname in Cloudflare Zero Trust"
                ready={readyCount === 3}
              />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-cyan-200" /> Docker sidecar blueprint
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Jalankan `cloudflared` sebagai sidecar di host Docker yang sama dengan OmniGrid. Service Cloudflare akan meneruskan traffic ke app internal di port `3000`.
              </p>
              <CodeBlock
                content={`services:\n  omnigrid:\n    image: your-registry/omnigrid:latest\n    ports:\n      - \"3000:3000\"\n\n  cloudflared:\n    image: cloudflare/cloudflared:latest\n    restart: unless-stopped\n    command: tunnel --no-autoupdate run\n    environment:\n      - TUNNEL_TOKEN=<paste-token-from-settings>\n    depends_on:\n      - omnigrid`}
              />
              <CodeBlock
                content={`Public hostname\n  Hostname: ${zoneHint}\n  Service: http://omnigrid:3000`}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">Operational notes</CardTitle>
            <Link href="https://one.dash.cloudflare.com/" target="_blank" rel="noreferrer">
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" /> Open Cloudflare Zero Trust
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <InfoTile
              title="Service target"
              body="Point the Cloudflare public hostname to http://omnigrid:3000 when both containers share the same Docker network."
            />
            <InfoTile
              title="OAuth consistency"
              body={`Your GitHub OAuth callback and session cookies should use ${publicOrigin} as the canonical public origin.`}
            />
            <InfoTile
              title="API token"
              body="Optional API token support is already stored per workspace and can be used next for domain/tunnel inspection features."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusTile({
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

function ChecklistItem({ label, ready }: { label: string; ready: boolean }) {
  const Icon = ready ? CheckCircle2 : CircleDashed;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
      <Icon className={ready ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-muted-foreground"} />
      <span className={ready ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function InfoTile({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function CodeBlock({ content }: { content: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-6 text-cyan-100">
      <code>{content}</code>
    </pre>
  );
}
