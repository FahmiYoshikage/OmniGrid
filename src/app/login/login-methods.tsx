"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import type { AuthAvailability } from "@/lib/auth/availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginMethods({ availability }: { availability: AuthAvailability }) {
  const [loadingProvider, setLoadingProvider] = useState<"github" | "google" | null>(null);
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  async function requestEmailLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingEmail(true);
    setEmailSent(null);

    try {
      const res = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, intent: "login" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to send sign-in link.");
      }
      setEmailSent(email);
      toast.success("Sign-in link sent. Check your email inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send sign-in link.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="space-y-4">
      {availability.github ? (
        <OAuthButton
          href="/api/auth/github"
          loading={loadingProvider === "github"}
          onClick={() => setLoadingProvider("github")}
          idleLabel="Sign in with GitHub"
          loadingLabel="Redirecting to GitHub..."
          icon={<GitHubIcon className="h-5 w-5" />}
          className="bg-white text-slate-900 hover:bg-white/95"
        />
      ) : null}

      {availability.google ? (
        <OAuthButton
          href="/api/auth/google"
          loading={loadingProvider === "google"}
          onClick={() => setLoadingProvider("google")}
          idleLabel="Sign in with Google"
          loadingLabel="Redirecting to Google..."
          icon={<GoogleIcon className="h-5 w-5" />}
          className="border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]"
        />
      ) : null}

      {availability.email ? (
        <form onSubmit={requestEmailLink} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Mail className="h-4 w-4 text-cyan-200" />
            Sign in with email link
          </div>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@gmail.com"
            className="h-11 bg-white/[0.04]"
            required
            disabled={sendingEmail}
          />
          <Button type="submit" className="w-full" disabled={sendingEmail || !email.trim()}>
            {sendingEmail ? <Send className="mr-2 h-4 w-4 animate-pulse" /> : <Send className="mr-2 h-4 w-4" />}
            {sendingEmail ? "Sending secure link..." : "Send sign-in link"}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            We&apos;ll send a one-time secure link to your Gmail inbox. No password is stored in OmniGrid Network Architecture.
          </p>
          {emailSent ? <p className="text-xs text-emerald-200/80">Magic link sent to {emailSent}.</p> : null}
        </form>
      ) : null}

      {!availability.github && !availability.google && !availability.email ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          No login method is configured yet. Add GitHub, Google, or Gmail SMTP settings in the OmniGrid Network Architecture platform environment.
        </div>
      ) : null}
    </div>
  );
}

function OAuthButton({
  href,
  loading,
  onClick,
  idleLabel,
  loadingLabel,
  icon,
  className,
}: {
  href: string;
  loading: boolean;
  onClick: () => void;
  idleLabel: string;
  loadingLabel: string;
  icon: React.ReactNode;
  className: string;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`group flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-sm font-semibold shadow-lg shadow-white/5 transition-all duration-200 ${loading ? "pointer-events-none bg-white/80 text-slate-500" : className}`}
    >
      {loading ? (
        <>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          {loadingLabel}
        </>
      ) : (
        <>
          <span className="transition-transform duration-200 group-hover:scale-110">{icon}</span>
          {idleLabel}
        </>
      )}
    </a>
  );
}

function GitHubIcon({ className }: { className?: string }) {
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 2.9 14.6 2 12 2 6.9 2 2.8 6.2 2.8 11.4S6.9 20.8 12 20.8c6.2 0 8.7-4.4 8.7-6.7 0-.5 0-.8-.1-1.1H12Z" />
      <path fill="#FBBC05" d="M2.8 7.1l3.2 2.3c.9-2 3-3.4 5.9-3.4 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 2.9 14.6 2 12 2 8.1 2 4.8 4.2 2.8 7.1Z" />
      <path fill="#34A853" d="M12 20.8c2.6 0 4.8-.9 6.4-2.6l-3-2.5c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.2-2.6-5.5-3.9L3.3 15.4C5.2 18.5 8.3 20.8 12 20.8Z" />
      <path fill="#4285F4" d="M20.7 14.1c.1-.3.1-.6.1-1.1s0-.8-.1-1.1H12v3.9h8.7Z" />
    </svg>
  );
}
