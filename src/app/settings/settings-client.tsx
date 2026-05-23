"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, RefreshCw, Save, ShieldCheck } from "lucide-react";
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

export function SettingsClient() {
  const [settings, setSettings] = useState<TailscaleSettings>({ tailnet: "", hasApiKey: false, updatedAt: null });
  const [tailnet, setTailnet] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/tailscale");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { settings: TailscaleSettings };
      setSettings(data.settings);
      setTailnet(data.settings.tailnet);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/tailscale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tailnet, apiKey: apiKey || undefined, clearApiKey }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { settings: TailscaleSettings };
      setSettings(data.settings);
      setApiKey("");
      setClearApiKey(false);
      toast.success("Tailscale settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 p-8 lg:grid-cols-[1fr_0.75fr]">
      <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-cyan-200" />
            Tailscale integration
          </CardTitle>
          <Badge variant={settings.hasApiKey ? "default" : "secondary"}>
            {settings.hasApiKey ? "API key saved" : "Not configured"}
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
              disabled={loading || saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">Tailscale API key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={settings.hasApiKey ? "Leave empty to keep current key" : "tskey-api-..."}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              disabled={loading || saving || clearApiKey}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              This secret is encrypted at rest per workspace. It replaces the old global env-based Tailscale setup.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={clearApiKey}
              onChange={(event) => setClearApiKey(event.target.checked)}
              className="h-4 w-4 accent-cyan-300"
            />
            Clear saved API key on save
          </label>
          <div className="flex gap-2">
            <Button onClick={save} disabled={loading || saving || !tailnet.trim()}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save settings
            </Button>
            <Button variant="outline" onClick={load} disabled={loading || saving}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-gradient-to-br from-cyan-400/10 to-emerald-400/5 shadow-2xl shadow-black/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
            SaaS security model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>Integration tokens belong to the current workspace, not the platform environment.</p>
          <p>API keys are never returned to the browser after saving; only their presence is shown.</p>
          {settings.updatedAt && <p>Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
