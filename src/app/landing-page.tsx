import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, KeyRound, Network, ShieldCheck, TerminalSquare, Zap } from "lucide-react";
import { LandingSessionGuard } from "./landing-session-guard";

const FEATURES = [
  {
    icon: TerminalSquare,
    title: "Multi SSH workspace",
    description: "Open many servers in tabs, keep sessions alive, and jump back without reconnecting.",
  },
  {
    icon: KeyRound,
    title: "Credential vault",
    description: "Reusable password and private-key profiles encrypted with AES-256-GCM.",
  },
  {
    icon: Network,
    title: "Topology view",
    description: "See Tailscale devices and local inventory in one operational map.",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <LandingSessionGuard />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-20rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute bottom-[-18rem] right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-20 left-[-12rem] h-[28rem] w-[28rem] rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <nav className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
              <Image src="/logo.svg" alt="OmniGrid Network Architecture" width={30} height={30} priority />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight sm:text-base">OmniGrid Network Architecture</div>
              <div className="text-xs text-cyan-100/60">Zero Trust server operations</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Sign in
            </Link>
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Secure control plane for your lab and VPS fleet
            </div>
            <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
              Operate every node from one encrypted command center.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              OmniGrid Network Architecture brings SSH tabs, topology, credentials, and operational context into a polished dashboard built for homelabs, VPS fleets, and private networks.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-slate-950 shadow-2xl shadow-white/10 transition hover:-translate-y-0.5"
              >
                Sign in to OmniGrid Network Architecture <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Open dashboard
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    <Zap className="h-4 w-4" /> Live workspace
                  </div>
                  <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">3 active SSH tabs</div>
                </div>
                <div className="space-y-3">
                  {["homelab-nas", "vps-prod-01", "router-edge"].map((name, index) => (
                    <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm text-white">{name}</div>
                          <div className="mt-1 text-xs text-slate-400">session #{index + 1} · encrypted credential profile</div>
                        </div>
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 pb-8 md:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p>
              </div>
            );
          })}
        </div>

        <section className="grid gap-6 pb-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-200">
              <FileText className="h-4 w-4 text-cyan-200" /> OmniGrid Docs
            </div>
            <h2 className="text-3xl font-black tracking-tight">Full operator docs are now live.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Learn the OmniGrid Network Architecture standard, workspace-scoped integrations, and Zero Trust deployment flows.
              Everything from first boot to Cloudflare Tunnel publishing is covered in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Open documentation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs#bootstrap"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Bootstrap a node
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/40">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">One-line bootstrap</div>
            <p className="mt-2 text-sm text-slate-300">
              Turn any Linux host into the OmniGrid Network Architecture standard in seconds.
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-cyan-100">
              curl -fsSL https://gist.githubusercontent.com/FahmiYoshikage/38fbbbfe4ab544bb16e9844efec64e51/raw/ce59bb410f50f0f13096068de5d77695c1f4b077/omnigrid-bootstrap.sh | sudo bash
            </div>
            <p className="mt-3 text-xs text-slate-400">
              This script installs Docker, joins omnigrid-net, and prepares the host for managed workloads.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-3 pb-4 text-xs text-slate-500">
          <Link href="/docs" className="transition hover:text-white">
            Documentation
          </Link>
          <span>•</span>
          <Link href="/privacy-policy" className="transition hover:text-white">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/terms" className="transition hover:text-white">
            Terms of Service
          </Link>
        </div>
      </section>
    </main>
  );
}
