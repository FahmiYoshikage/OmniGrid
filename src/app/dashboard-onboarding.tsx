"use client";

import { useEffect, useState } from "react";
import { Activity, KeyRound, LayoutDashboard, Network, Server, Settings, Terminal } from "lucide-react";

const STEPS = [
  {
    icon: LayoutDashboard,
    title: "Overview",
    body: "Ringkasan kondisi workspace kamu: jumlah device Tailnet, managed nodes, audit terbaru, dan status integrasi.",
  },
  {
    icon: Network,
    title: "Topology",
    body: "Peta visual perangkat Tailscale dan node yang kamu kelola, supaya cepat paham relasi antar host.",
  },
  {
    icon: Server,
    title: "Nodes",
    body: "Tempat mendaftarkan server, VPS, homelab device, SSH user, port, tag, dan mode koneksi.",
  },
  {
    icon: KeyRound,
    title: "Credentials",
    body: "Vault terenkripsi untuk password dan private key profile. Secret tidak pernah ditampilkan ulang ke browser.",
  },
  {
    icon: Terminal,
    title: "Terminal",
    body: "SSH multi-tab langsung dari browser. Cocok untuk operasi cepat tanpa berpindah aplikasi.",
  },
  {
    icon: Settings,
    title: "Settings",
    body: "Masukkan Tailscale API key dan Cloudflare Zero Trust token per workspace, bukan lewat env global.",
  },
];

export function DashboardOnboarding({ open }: { open: boolean }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const skipped = window.localStorage.getItem("omnigrid_onboarding_done") === "1";
    if (open && !skipped) setVisible(true);
  }, [open]);

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  function close() {
    window.localStorage.setItem("omnigrid_onboarding_done", "1");
    setVisible(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-6 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="relative border-b border-white/10 px-7 py-6">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/15 via-transparent to-emerald-400/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">Quick orientation</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Kenali workspace OmniGrid Network Architecture</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Overview singkat supaya kamu tahu tab utama dipakai untuk apa. Bisa di-skip kapan saja.</p>
            </div>
            <button type="button" onClick={close} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white">
              Skip
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-7 md:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-2">
            {STEPS.map((item, index) => {
              const StepIcon = item.icon;
              const active = index === step;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition ${
                    active
                      ? "border-cyan-300/30 bg-cyan-300/10 text-white"
                      : "border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.06]">
                    <StepIcon className="h-4 w-4" />
                  </span>
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>

          <div className="flex min-h-80 flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div>
              <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300/20 to-emerald-300/10 text-cyan-100 ring-1 ring-white/10">
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-white">{current.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{current.body}</p>
            </div>

            <div className="mt-8">
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40">
                  Back
                </button>
                <button type="button" onClick={() => (isLast ? close() : setStep(step + 1))} className="rounded-2xl bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                  {isLast ? "Start using OmniGrid Network Architecture" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
