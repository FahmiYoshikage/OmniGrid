"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvitationAcceptance({ token }: { token: string }) {
  const [status, setStatus] = useState<"accepting" | "accepted" | "sign-in" | "error">("accepting");
  const [message, setMessage] = useState("Joining workspace...");

  useEffect(() => {
    let cancelled = false;
    async function accept() {
      try {
        const response = await fetch(`/api/workspace/invitations/${encodeURIComponent(token)}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (cancelled) return;
        if (response.status === 401) {
          window.sessionStorage.setItem("omnigrid_pending_invitation", token);
          setStatus("sign-in");
          setMessage("Sign in with the invited email address to join this workspace.");
          return;
        }
        if (!response.ok) throw new Error(data.error || "This invitation cannot be accepted.");
        setStatus("accepted");
        setMessage("You are now a member of this workspace.");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "This invitation cannot be accepted.");
      }
    }
    void accept();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-cyan-300/15 text-cyan-100">
          {status === "accepting" ? <LoaderCircle className="h-6 w-6 animate-spin" /> : status === "accepted" ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>
        <h1 className="mt-5 text-xl font-semibold">Workspace invitation</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        {status === "accepted" ? <Link href="/dashboard" className="mt-6 inline-flex"><Button>Open dashboard</Button></Link> : null}
        {status === "sign-in" ? <Link href={`/login?invite=${encodeURIComponent(token)}`} className="mt-6 inline-flex"><Button>Sign in</Button></Link> : null}
        {status === "error" ? <Link href="/dashboard" className="mt-6 inline-flex"><Button variant="outline">Open dashboard</Button></Link> : null}
      </section>
    </main>
  );
}
