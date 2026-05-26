"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Cloud, KeyRound, Mail, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthAvailability } from "@/lib/auth/availability";

interface TailscaleSettings {
  tailnet: string;
  hasApiKey: boolean;
  updatedAt: number | null;
}

interface CloudflareSettings {
  accountId: string;
  hasTunnelToken: boolean;
  hasApiToken: boolean;
  updatedAt: number | null;
}

interface AuthMethodSummary {
  provider: "github" | "google" | "email";
  providerUserId: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: number;
}

export function SettingsClient({
  sessionEmail,
  initialAuthAvailability,
}: {
  sessionEmail: string;
  initialAuthAvailability: AuthAvailability;
}) {
  const searchParams = useSearchParams();

  // Tailscale state
  const [tsSettings, setTsSettings] = useState<TailscaleSettings>({ tailnet: "", hasApiKey: false, updatedAt: null });
  const [tailnet, setTailnet] = useState("");
  const [tsApiKey, setTsApiKey] = useState("");
  const [clearTsKey, setClearTsKey] = useState(false);
  const [tsLoading, setTsLoading] = useState(true);
  const [tsSaving, setTsSaving] = useState(false);

  const [authMethods, setAuthMethods] = useState<AuthMethodSummary[]>([]);
  const [authAvailability, setAuthAvailability] = useState<AuthAvailability>(initialAuthAvailability);
  const [authLoading, setAuthLoading] = useState(true);
  const [emailLinkAddress, setEmailLinkAddress] = useState(sessionEmail);
  const [sendingEmailLink, setSendingEmailLink] = useState(false);
  const [authFeedbackHandled, setAuthFeedbackHandled] = useState(false);

  // Cloudflare state
  const [cfSettings, setCfSettings] = useState<CloudflareSettings>({ accountId: "", hasTunnelToken: false, hasApiToken: false, updatedAt: null });
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfTunnelToken, setCfTunnelToken] = useState("");
  const [cfApiToken, setCfApiToken] = useState("");
  const [clearCfToken, setClearCfToken] = useState(false);
  const [clearCfApiToken, setClearCfApiToken] = useState(false);
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

  async function loadAuthMethods() {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/methods", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { methods: AuthMethodSummary[]; availability: AuthAvailability };
      setAuthMethods(data.methods);
      setAuthAvailability(data.availability);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load login methods");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    void loadAuthMethods();
    void loadTailscale();
    void loadCloudflare();
  }, []);

  useEffect(() => {
    if (authFeedbackHandled) return;
    const auth = searchParams.get("auth");
    const authError = searchParams.get("authError");
    if (!auth && !authError) return;

    if (auth === "github-linked") toast.success("GitHub login linked");
    if (auth === "google-linked") toast.success("Google login linked");
    if (auth === "email-linked") toast.success("Email login linked");
    if (authError === "github-link-failed") toast.error("Failed to link GitHub login");
    if (authError === "google-link-failed") toast.error("Failed to link Google login");
    if (authError === "email-link-failed") toast.error("Failed to link email login");

    setAuthFeedbackHandled(true);
    void loadAuthMethods();
    window.history.replaceState({}, "", "/settings");
  }, [authFeedbackHandled, searchParams]);

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
          clearApiToken: clearCfApiToken,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { settings: CloudflareSettings };
      setCfSettings(data.settings);
      setCfTunnelToken("");
      setCfApiToken("");
      setClearCfToken(false);
      setClearCfApiToken(false);
      toast.success("Cloudflare settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save Cloudflare settings");
    } finally {
      setCfSaving(false);
    }
  }

  async function sendEmailLink() {
    setSendingEmailLink(true);
    try {
      const res = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLinkAddress, intent: "link" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to send email link");
      toast.success("Link email sent. Check your inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email link");
    } finally {
      setSendingEmailLink(false);
    }
  }

  const linkedProviders = new Set(authMethods.map((method) => method.provider));

  return (
    <div className="space-y-6 p-8">
      <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
            Login methods
          </CardTitle>
          <Badge variant={authMethods.length ? "default" : "secondary"}>
            {authMethods.length} linked
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Link one or many identity providers to the same OmniGrid account. Once linked, you can sign in using any of those methods.
          </p>

          <div className="grid gap-4 lg:grid-cols-3">
            <ProviderCard
              title="GitHub"
              ready={authAvailability.github}
              linked={linkedProviders.has("github")}
              description="OAuth login for engineering-friendly sign-in and account linking."
              actionLabel={linkedProviders.has("github") ? "GitHub linked" : "Connect GitHub"}
              onClick={() => { window.location.href = "/api/auth/github?intent=link"; }}
              disabled={!authAvailability.github || linkedProviders.has("github")}
              icon={<GitHubMark className="h-4 w-4" />}
            />
            <ProviderCard
              title="Google"
              ready={authAvailability.google}
              linked={linkedProviders.has("google")}
              description="Google OAuth with verified email so the same account can sign in from Google too."
              actionLabel={linkedProviders.has("google") ? "Google linked" : "Connect Google"}
              onClick={() => { window.location.href = "/api/auth/google?intent=link"; }}
              disabled={!authAvailability.google || linkedProviders.has("google")}
              icon={<GoogleMark className="h-4 w-4" />}
            />
            <ProviderCard
              title="Email magic link"
              ready={authAvailability.email}
              linked={linkedProviders.has("email")}
              description="Passwordless sign-in via Gmail SMTP delivery using one-time secure links."
              actionLabel={linkedProviders.has("email") ? "Email linked" : "Send link"}
              onClick={sendEmailLink}
              disabled={!authAvailability.email || sendingEmailLink || !emailLinkAddress.trim() || linkedProviders.has("email")}
              icon={<Mail className="h-4 w-4" />}
            >
              <Input
                type="email"
                value={emailLinkAddress}
                onChange={(event) => setEmailLinkAddress(event.target.value)}
                placeholder="you@gmail.com"
                className="h-10 bg-white/[0.04]"
                disabled={!authAvailability.email || sendingEmailLink || linkedProviders.has("email")}
              />
            </ProviderCard>
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Linked identities</div>
            {authLoading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">Loading linked login methods...</div>
            ) : authMethods.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">No linked identities found for this account yet.</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {authMethods.map((method) => (
                  <div key={`${method.provider}-${method.providerUserId}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        {method.provider === "github" ? <GitHubMark className="h-4 w-4" /> : method.provider === "google" ? <GoogleMark className="h-4 w-4" /> : <Mail className="h-4 w-4 text-cyan-200" />}
                        <span className="capitalize">{method.provider}</span>
                      </div>
                      <Badge variant="outline">linked</Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div>{method.displayName || method.username || method.email || method.providerUserId}</div>
                      {method.email ? <div>{method.email}</div> : null}
                      <div>Linked {new Date(method.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
          <Badge variant={cfSettings.hasTunnelToken && cfSettings.hasApiToken ? "default" : "secondary"}>
            {cfSettings.hasTunnelToken && cfSettings.hasApiToken ? "Monitoring ready" : "Partial setup"}
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
              <p className="text-xs leading-5 text-muted-foreground">
                {cfSettings.hasTunnelToken ? "Tunnel token saved for this workspace." : "Needed to run cloudflared with a remotely managed tunnel."}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cfApiToken">Cloudflare API Token (optional)</Label>
            <Input
              id="cfApiToken"
              type="password"
              placeholder={cfSettings.hasApiToken ? "Leave empty to keep current API token" : "For monitoring domains and published apps"}
              value={cfApiToken}
              onChange={(event) => setCfApiToken(event.target.value)}
              disabled={cfLoading || cfSaving || clearCfApiToken}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Optional but recommended. Used to list tunnels, published hostnames, Access apps, zones, and DNS records. Ideal permissions: <code className="text-cyan-200/80">Cloudflare Tunnel:Read/Edit</code>, <code className="text-cyan-200/80">Access: Apps and Policies Read</code>, <code className="text-cyan-200/80">Zone:Read</code>, and <code className="text-cyan-200/80">DNS:Read/Edit</code>.
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
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={clearCfApiToken}
              onChange={(event) => setClearCfApiToken(event.target.checked)}
              className="h-4 w-4 accent-orange-300"
            />
            Clear saved API token on save
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

function ProviderCard({
  title,
  description,
  ready,
  linked,
  actionLabel,
  onClick,
  disabled,
  icon,
  children,
}: {
  title: string;
  description: string;
  ready: boolean;
  linked: boolean;
  actionLabel: string;
  onClick: () => void | Promise<void>;
  disabled: boolean;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          {icon}
          {title}
        </div>
        <Badge variant={linked ? "default" : ready ? "secondary" : "outline"}>
          {linked ? "Linked" : ready ? "Available" : "Disabled"}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      {children ? <div className="mt-3">{children}</div> : null}
      <Button className="mt-4 w-full" variant={linked ? "outline" : "default"} onClick={() => void onClick()} disabled={disabled}>
        {title === "Email magic link" ? <Send className="mr-2 h-4 w-4" /> : null}
        {actionLabel}
      </Button>
    </div>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 2.9 14.6 2 12 2 6.9 2 2.8 6.2 2.8 11.4S6.9 20.8 12 20.8c6.2 0 8.7-4.4 8.7-6.7 0-.5 0-.8-.1-1.1H12Z" />
      <path fill="#FBBC05" d="M2.8 7.1l3.2 2.3c.9-2 3-3.4 5.9-3.4 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 2.9 14.6 2 12 2 8.1 2 4.8 4.2 2.8 7.1Z" />
      <path fill="#34A853" d="M12 20.8c2.6 0 4.8-.9 6.4-2.6l-3-2.5c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.2-2.6-5.5-3.9L3.3 15.4C5.2 18.5 8.3 20.8 12 20.8Z" />
      <path fill="#4285F4" d="M20.7 14.1c.1-.3.1-.6.1-1.1s0-.8-.1-1.1H12v3.9h8.7Z" />
    </svg>
  );
}
