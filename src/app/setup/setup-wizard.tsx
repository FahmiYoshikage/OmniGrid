"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  Key,
  Lock,
  RefreshCw,
  Server,
  Shield,
  XCircle,
} from "lucide-react";
import type { PreflightStatus } from "@/lib/setup/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SetupWizardProps {
  preflight: PreflightStatus;
}

export function SetupWizard({ preflight }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [username, setUsername] = useState("admin");
  const [displayName, setDisplayName] = useState("Primary Administrator");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [workspaceName, setWorkspaceName] = useState("Primary Fleet");
  const [tailscaleTailnet, setTailscaleTailnet] = useState("");
  const [tailscaleApiKey, setTailscaleApiKey] = useState("");
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [cloudflareTunnelToken, setCloudflareTunnelToken] = useState("");

  const steps = [
    { number: 1, title: "Preflight Check", desc: "System readiness" },
    { number: 2, title: "Admin Account", desc: "Root credentials" },
    { number: 3, title: "Fleet Network", desc: "Workspace & integrations" },
  ];

  function handleNextStep() {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!username.trim() || username.trim().length < 3) {
        toast.error("Username must be at least 3 characters long");
        return;
      }
      if (!password || password.length < 8) {
        toast.error("Password must be at least 8 characters long");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      setStep(3);
    }
  }

  async function handleFinishSetup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim() || undefined,
          email: email.trim() || undefined,
          password,
          workspaceName: workspaceName.trim() || "Primary Fleet",
          tailscaleTailnet: tailscaleTailnet.trim() || undefined,
          tailscaleApiKey: tailscaleApiKey.trim() || undefined,
          cloudflareAccountId: cloudflareAccountId.trim() || undefined,
          cloudflareTunnelToken: cloudflareTunnelToken.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        redirect?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Setup initialization failed");
      }

      toast.success("OmniGrid successfully initialized! Launching dashboard...");
      router.push(data.redirect || "/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Initialization failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-8">
      {/* Ambient decorative backdrops */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Header */}
          <div className="relative border-b border-white/10 px-8 pb-6 pt-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-white/10 to-white/5 shadow-lg shadow-cyan-500/10 ring-1 ring-white/10">
                  <Image
                    src="/logo.svg"
                    alt="OmniGrid"
                    width={32}
                    height={32}
                    className="drop-shadow-lg"
                    priority
                  />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    Initial System Setup
                  </h1>
                  <p className="text-xs text-cyan-200/60">
                    OmniGrid Zero Trust Control Plane Onboarding
                  </p>
                </div>
              </div>
              <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                Step {step} of 3
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              {steps.map((s) => (
                <div key={s.number} className="space-y-1.5">
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                      step >= s.number
                        ? "bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-sm shadow-cyan-400/50"
                        : "bg-white/10"
                    }`}
                  />
                  <div className="hidden sm:block">
                    <p
                      className={`text-xs font-medium ${
                        step >= s.number ? "text-white" : "text-muted-foreground"
                      }`}
                    >
                      {s.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Preflight System Verification
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Verifying underlying server environment, runtime
                    compatibility, and persistent storage health.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <PreflightItem
                    title="Node.js Engine"
                    value={preflight.nodeVersion}
                    ok={preflight.nodeValid}
                    icon={<Cpu className="h-4 w-4" />}
                    detail="Requires Node v20+"
                  />
                  <PreflightItem
                    title="Database Storage"
                    value={preflight.databaseHealthy ? "Healthy & Intact" : "Failed"}
                    ok={preflight.databaseHealthy}
                    icon={<Database className="h-4 w-4" />}
                    detail="SQLite PRAGMA check"
                  />
                  <PreflightItem
                    title="Master Cryptography"
                    value={preflight.encryptionReady ? "AES-256-GCM Active" : "Invalid Key"}
                    ok={preflight.encryptionReady}
                    icon={<Lock className="h-4 w-4" />}
                    detail="OMNIGRID_MASTER_KEY"
                  />
                  <PreflightItem
                    title="Docker Engine"
                    value={preflight.dockerAvailable ? "Socket Detected" : "Not Detected"}
                    ok={preflight.dockerAvailable}
                    warning={!preflight.dockerAvailable}
                    icon={<Server className="h-4 w-4" />}
                    detail="/var/run/docker.sock (optional)"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-zinc-300">
                    Self-Hosted Deployment Note:
                  </p>
                  <p className="mt-1 leading-relaxed">
                    OmniGrid runs self-contained as a single-port service. All
                    sensitive credentials (tokens, SSH keys, webhook secrets)
                    are authenticated and encrypted using your master key.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleNextStep}
                    className="gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold"
                  >
                    Continue to Admin Setup
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Create Administrator Account
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This will be the root owner account for your OmniGrid instance.
                    You will use these credentials to sign in directly without
                    relying on third-party OAuth providers.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-white">
                        Admin Username <span className="text-cyan-400">*</span>
                      </Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        className="h-10 bg-white/[0.04] text-white"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Alphanumeric, lowercase
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="displayName" className="text-white">
                        Display Name
                      </Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Primary Administrator"
                        className="h-10 bg-white/[0.04] text-white"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Shown in header & logs
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">
                      Email Address (Optional)
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@yourdomain.com"
                      className="h-10 bg-white/[0.04] text-white"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Used for incident alert delivery and notifications
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-white">
                        Root Password <span className="text-cyan-400">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="h-10 bg-white/[0.04] text-white"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Minimum 8 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-white">
                        Confirm Password <span className="text-cyan-400">*</span>
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="h-10 bg-white/[0.04] text-white"
                        required
                      />
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-[11px] text-red-400">
                          Passwords do not match
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="gap-2 text-zinc-300 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    disabled={
                      !username ||
                      !password ||
                      password.length < 8 ||
                      password !== confirmPassword
                    }
                    className="gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold"
                  >
                    Next: Fleet Network
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form onSubmit={handleFinishSetup} className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Fleet Workspace & Integrations
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Configure your primary workspace. Third-party integrations
                    are optional and can also be connected anytime later in
                    Settings.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspaceName" className="text-white">
                      Primary Workspace Name
                    </Label>
                    <Input
                      id="workspaceName"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Primary Fleet"
                      className="h-10 bg-white/[0.04] text-white"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The default environment for your servers and monitors
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Shield className="h-4 w-4 text-emerald-400" />
                      Optional: Tailscale Zero Trust Mesh
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="tailscaleTailnet" className="text-xs text-zinc-300">
                          Tailnet Name
                        </Label>
                        <Input
                          id="tailscaleTailnet"
                          value={tailscaleTailnet}
                          onChange={(e) => setTailscaleTailnet(e.target.value)}
                          placeholder="your-tailnet.ts.net"
                          className="h-8 text-xs bg-white/[0.03] text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tailscaleApiKey" className="text-xs text-zinc-300">
                          API Key / Auth Key
                        </Label>
                        <Input
                          id="tailscaleApiKey"
                          type="password"
                          value={tailscaleApiKey}
                          onChange={(e) => setTailscaleApiKey(e.target.value)}
                          placeholder="tskey-api-..."
                          className="h-8 text-xs bg-white/[0.03] text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Key className="h-4 w-4 text-amber-400" />
                      Optional: Cloudflare Tunnel
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="cloudflareAccountId" className="text-xs text-zinc-300">
                          Account ID
                        </Label>
                        <Input
                          id="cloudflareAccountId"
                          value={cloudflareAccountId}
                          onChange={(e) => setCloudflareAccountId(e.target.value)}
                          placeholder="cf-account-id"
                          className="h-8 text-xs bg-white/[0.03] text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cloudflareTunnelToken" className="text-xs text-zinc-300">
                          Tunnel Token
                        </Label>
                        <Input
                          id="cloudflareTunnelToken"
                          type="password"
                          value={cloudflareTunnelToken}
                          onChange={(e) => setCloudflareTunnelToken(e.target.value)}
                          placeholder="eyJh..."
                          className="h-8 text-xs bg-white/[0.03] text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(2)}
                    disabled={submitting}
                    className="gap-2 text-zinc-300 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="gap-2 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-bold hover:opacity-90 shadow-lg shadow-cyan-500/20 px-6"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Initializing OmniGrid...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Complete Setup & Launch
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreflightItem({
  title,
  value,
  ok,
  warning,
  icon,
  detail,
}: {
  title: string;
  value: string;
  ok: boolean;
  warning?: boolean;
  icon: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <span className="text-cyan-300">{icon}</span>
          {title}
        </div>
        <div className="text-xs font-mono text-white/90">{value}</div>
        <div className="text-[10px] text-muted-foreground">{detail}</div>
      </div>
      <div>
        {ok ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
        ) : warning ? (
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-red-400 shrink-0" />
        )}
      </div>
    </div>
  );
}
