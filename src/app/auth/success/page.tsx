"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

const BASE_STEPS = [
  { label: "Authenticating securely", icon: "🔐" },
  { label: "Loading your workspace", icon: "📦" },
  { label: "Syncing integrations", icon: "🔄" },
  { label: "Preparing dashboard", icon: "✨" },
];

const STEP_MS = 220;
const FADE_BUFFER_MS = 120;
const REDIRECT_BUFFER_MS = 220;

export default function AuthSuccessPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [provider, setProvider] = useState("account");
  const steps = useMemo(
    () => [{ label: `Authenticating with ${provider === "email" ? "Email Link" : provider.charAt(0).toUpperCase() + provider.slice(1)}`, icon: "🔐" }, ...BASE_STEPS.slice(1)],
    [provider],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProvider(params.get("provider") ?? "account");
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((_, i) => {
      if (i > 0) {
        timers.push(setTimeout(() => setCurrentStep(i), i * STEP_MS));
      }
    });

    timers.push(setTimeout(() => setFadeOut(true), steps.length * STEP_MS + FADE_BUFFER_MS));

    timers.push(setTimeout(() => {
      window.location.replace("/dashboard?welcome=1");
    }, steps.length * STEP_MS + FADE_BUFFER_MS + REDIRECT_BUFFER_MS));

    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <div
      className={`flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 backdrop-blur-xl">
          {/* Header */}
          <div className="relative flex flex-col items-center gap-4 border-b border-white/10 px-8 pb-8 pt-10">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/10 via-transparent to-transparent" />
            
            {/* Spinning logo */}
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-white/10 to-white/5 shadow-lg shadow-cyan-500/10 ring-1 ring-white/10">
              <div className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-cyan-400/60 animate-spin" style={{ animationDuration: "2s" }} />
              <Image
                src="/logo.svg"
                alt="OmniGrid Network Architecture"
                width={56}
                height={56}
                className="drop-shadow-lg"
                priority
              />
            </div>
            
            <div className="relative text-center">
              <h1 className="text-balance text-xl font-bold tracking-tight text-white sm:text-2xl">
                Welcome to OmniGrid Network Architecture
              </h1>
              <p className="mt-1 text-sm text-emerald-100/60">
                Setting up your session...
              </p>
            </div>
          </div>

          {/* Steps progress */}
          <div className="px-8 py-8">
            <div className="space-y-3">
              {steps.map((step, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div
                    key={step.label}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-500 ${
                      isActive
                        ? "border-cyan-400/30 bg-cyan-400/10 text-white"
                        : isDone
                          ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200/80"
                          : "border-white/5 bg-transparent text-white/30"
                    }`}
                  >
                    <span className="text-lg">{isDone ? "✅" : step.icon}</span>
                    <span className="flex-1 text-sm font-medium">{step.label}</span>
                    {isActive && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-700 ease-out"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
