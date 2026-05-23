"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, RefreshCw, Save, ShieldCheck, Cloud, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TailscaleSettings {
  tailnet: string;
  hasApiKey: boolean;
  updatedAt: number | null;
}

interface CloudflareSettings {
  accountId: string;
  hasTunnelToken: boolean;
  updatedAt: number | null;
}

export function SettingsClient() {
  // Tailscale state
  const [tsSettings, setTsSettings] = useState<TailscaleSettings>({ tailnet: "", hasApiKey: false, updatedAt: null });
  const [tailnet, setTailnet] = useState("");
  const [tsApiKey, setTsApiKey] = useState("");
  const [clearTsKey, setClearTsKey] = useState(false);
  const [tsLoading, setTsLoading] = useState(true);
  const [tsSaving, setTsSaving] = useState(false);

  // Cloudflare state
  const [cfSettings, setCfSettings] = useState<CloudflareSettings>({ accountId: "", hasTunnelToken: false, updatedAt: null });
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfTunnelToken, setCfTunnelToken] = useState("");
  const [cfApiToken, setCfApiToken] = useState("");
  const [clearCfToken, setClearCfToken] = useState(false);
  const [cfLoading, setCfLoading] = useState(true);
  const [cfSaving, setCfSaving] = useState(false);

  async function loadTailscale() {
    setTsLoading(true);
    try {
      const res = await fetch("/api/settings/tailscale");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { settings: TailscaleSettings };
      setTsSettings(data.settings);
      setTailnet(data.settings.tailnet);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Tailscale settings");
    } finally {
      setTsLoading(false);
    }
  }

  async function loadCloudflare() {
    setCfLoading(true);
    try {
      const res = await fetch("/api/settings/cloudflare");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { settings: CloudflareSettings };
      setCfSettings(data.settings);
      setCfAccountId(data.settings.accountId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Cloudflare settings");
    } finally {
      setCfLoading(false);
    }
  }

  useEffect(() => {
    void loadTailscale();
    void loadCloudflare();
  }, []);

  async function saveTailscale() {
    setTsSaving(true);
    try {
      const res = await fetch("/api/settings/tailscale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tailnet, apiKey: tsApiKey || undefined, clearApiKey: clearTsKey }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { settings: TailscaleSettings };
      setTsSettings(data.settings);
      setTsApiKey("");
      setClearTsKey(false);
      toast.success("Tailscale settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save Tailscale settings");
    } finally {
      setTsSaving(false);
    }
  }

  async function saveCloudflare() {
    setCfSaving(true);
    try {
      const res = await fetch("/api/settings/cloudflare", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: cfAccountId,
          tunnelToken: cfTunnelToken || undefined,
          apiToken: cfApiToken || undefined,
          clearTunnelToken: clearCfToken,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { settings: CloudflareSettings };
      setCfSettings(data.settings);
      setCfTunnelToken("");
      setCfApiToken("");
      setClearCfToken(false);
      toast.success("Cloudflare settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save Cloudflare settings");
    } finally {
      setCfSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-8">
      {/* Tailscale Integration */}
      <div className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
        <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-cyan-200" />
              Tailscale integration
            </CardTitle>
            <Badge variant={tsSettings.hasApiKey ? "default" : "secondary"}>
              {tsSettings.hasApiKey ? "API key saved" : "Not configured"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="tailnet">Tailnet</Label>
              <Input
                id="tailnet"
                placeholder="example.com or tailnet-name"
                value={tailnet}
                onChange={(event) => setTailnet(event.target.value)}
                disabled={tsLoading || tsSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tsApiKey">Tailscale API key</Label>
              <Input
                id="tsApiKey"
                type="password"
                placeholder={tsSettings.hasApiKey ? "Leave empty to keep current key" : "tskey-api-..."}
                value={tsApiKey}
                onChange={(event) => setTsApiKey(event.target.value)}
                disabled={tsLoading || tsSaving || clearTsKey}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                This secret is encrypted at rest per workspace. Used to query your Tailnet devices and topology.
              </p>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={clearTsKey}
                onChange={(event) => setClearTsKey(event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
              Clear saved API key on save
            </label>
            <div className="flex gap-2">
              <Button onClick={saveTailscale} disabled={tsLoading || tsSaving || !tailnet.trim()}>
                {tsSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save settings
              </Button>
              <Button variant="outline" onClick={loadTailscale} disabled={tsLoading || tsSaving}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-gradient-to-br from-cyan-400/10 to-emerald-400/5 shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              Security model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Integration tokens belong to the current workspace, not the platform environment.</p>
            <p>API keys and tunnel tokens are never returned to the browser after saving; only their presence is shown.</p>
            <p>All secrets are encrypted with AES-256-GCM at rest, scoped per workspace.</p>
            {(tsSettings.updatedAt || cfSettings.updatedAt) && (
              <p className="text-xs">
                Last updated: {new Date(Math.max(tsSettings.updatedAt ?? 0, cfSettings.updatedAt ?? 0)).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cloudflare Zero Trust */}
      <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4 text-orange-200" />
            Cloudflare Zero Trust
          </CardTitle>
          <Badge variant={cfSettings.hasTunnelToken ? "default" : "secondary"}>
            {cfSettings.hasTunnelToken ? "Tunnel configured" : "Not configured"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Connect your domains via Cloudflare Zero Trust Tunnel. This replaces the traditional reverse proxy approach
            with a secure, encrypted tunnel that doesn&apos;t require opening inbound ports.
          </p>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cfAccountId">Cloudflare Account ID</Label>
              <Input
                id="cfAccountId"
                placeholder="Your Cloudflare account ID"
                value={cfAccountId}
                onChange={(event) => setCfAccountId(event.target.value)}
                disabled={cfLoading || cfSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfTunnelToken">Tunnel Token</Label>
              <Input
                id="cfTunnelToken"
                type="password"
                placeholder={cfSettings.hasTunnelToken ? "Leave empty to keep current token" : "eyJ..."}
                value={cfTunnelToken}
                onChange={(event) => setCfTunnelToken(event.target.value)}
                disabled={cfLoading || cfSaving || clearCfToken}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cfApiToken">Cloudflare API Token (optional)</Label>
            <Input
              id="cfApiToken"
              type="password"
              placeholder="For monitoring domains assigned to the tunnel"
              value={cfApiToken}
              onChange={(event) => setCfApiToken(event.target.value)}
              disabled={cfLoading || cfSaving}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Optional. Used to list and monitor domains assigned to your Cloudflare tunnel. Requires <code className="text-cyan-200/80">Zone:Read</code> permission.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={clearCfToken}
              onChange={(event) => setClearCfToken(event.target.checked)}
              className="h-4 w-4 accent-orange-300"
            />
            Clear saved tunnel token on save
          </label>
          <div className="flex gap-2">
            <Button onClick={saveCloudflare} disabled={cfLoading || cfSaving || !cfAccountId.trim()}>
              {cfSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Cloudflare settings
            </Button>
            <Button variant="outline" onClick={loadCloudflare} disabled={cfLoading || cfSaving}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
