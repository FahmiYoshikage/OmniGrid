"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";

function LogoutContent() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 2500);
    const t2 = setTimeout(() => {
      window.location.replace("/");
    }, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      className={`flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="relative flex flex-col items-center gap-5 px-8 py-12">
            <div className="absolute inset-0 bg-gradient-to-b from-violet-400/10 via-transparent to-transparent" />

            {/* Logo with fade-down animation */}
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-white/10 to-white/5 shadow-lg shadow-violet-500/10 ring-1 ring-white/10 animate-bounce" style={{ animationDuration: "2s" }}>
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
              <h1 className="text-2xl font-bold tracking-tight text-white">
                See you later{name ? `, ${name}` : ""}!
              </h1>
              <p className="mt-2 text-sm text-violet-100/60">
                You&apos;ve been securely signed out.
              </p>
            </div>

            {/* Animated dots */}
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 rounded-full bg-violet-400/60 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>

            <p className="text-xs text-muted-foreground/50">
              Redirecting to landing page...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      }
    >
      <LogoutContent />
    </Suspense>
  );
}
