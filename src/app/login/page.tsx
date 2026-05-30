import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getAuthAvailability } from "@/lib/auth/availability";
import { LoginMethods } from "./login-methods";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const error = params.error;
  const availability = getAuthAvailability();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 backdrop-blur-xl">
          {/* Header */}
          <div className="relative flex flex-col items-center gap-4 border-b border-white/10 px-8 pb-8 pt-10">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/10 via-transparent to-transparent" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-white/10 to-white/5 shadow-lg shadow-cyan-500/10 ring-1 ring-white/10">
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
              <h1 className="text-balance text-2xl font-bold tracking-tight text-white">
                OmniGrid Network Architecture
              </h1>
              <p className="mt-1 text-sm text-cyan-100/60">
                Zero Trust server operations
              </p>
            </div>
          </div>

          {/* Login form */}
          <div className="px-8 py-8">
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Sign in to access your homelab dashboard, manage nodes, and control
              your infrastructure.
            </p>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
                {error === "invalid_state"
                  ? "Login session expired. Please try again."
                  : error === "invalid_email_link"
                    ? "Email link is invalid or has expired. Please request a new one."
                    : error === "login_required"
                      ? "Please sign in first before linking another login method."
                  : error === "auth_failed"
                    ? "Authentication failed. Please try again."
                    : "An error occurred. Please try again."}
              </div>
            )}

            <LoginMethods availability={availability} />

            <p className="mt-6 text-center text-xs text-muted-foreground/60">
              By signing in, you allow OmniGrid to verify your identity through the login methods you choose.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground/40">
          <p>OmniGrid Network Architecture — Secure control plane for your network and servers</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/privacy-policy" className="transition hover:text-white">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms" className="transition hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
