"use client";

import Link from "next/link";
import { Power, Radio, Server, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WolNode {
  id: string;
  name: string;
  hostname: string;
  mac_address: string | null;
  wol_broadcast: string | null;
}

export function WolClient({ nodes }: { nodes: WolNode[] }) {
  const [waking, setWaking] = useState<string | null>(null);

  async function wake(node: WolNode) {
    setWaking(node.id);
    try {
      const response = await fetch("/api/wol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: node.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Wake request failed");
      toast.success(`Magic packet sent to ${node.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wake request failed");
    } finally {
      setWaking(null);
    }
  }

  return (
    <div className="space-y-5 p-8">
      <div className="rounded-3xl border border-emerald-300/15 bg-gradient-to-r from-emerald-400/10 to-cyan-400/5 p-5 text-sm text-emerald-50/80">
        <div className="flex items-center gap-2 font-medium text-emerald-100"><Radio className="h-4 w-4" /> Network delivery</div>
        <p className="mt-2 max-w-3xl leading-6">The packet originates from the machine running OmniGrid. That machine must be able to reach the node&apos;s configured IPv4 broadcast network.</p>
      </div>
      {nodes.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <div><Server className="mx-auto h-8 w-8 text-cyan-200" /><h2 className="mt-4 font-semibold">No managed nodes</h2><p className="mt-2 text-sm text-muted-foreground">Add a node before configuring Wake-on-LAN.</p><Button render={<Link href="/nodes" />} className="mt-5">Add node</Button></div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {nodes.map((node) => {
            const ready = Boolean(node.mac_address && node.wol_broadcast);
            return (
              <article key={node.id} className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-5 shadow-xl shadow-black/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Power className="h-5 w-5" /></div><div className="min-w-0"><h2 className="truncate font-semibold">{node.name}</h2><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{node.hostname}</p></div></div>
                  <Badge variant="outline" className={ready ? "border-emerald-300/20 text-emerald-100" : "border-amber-300/20 text-amber-100"}>{ready ? "Ready" : "Setup required"}</Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="MAC address" value={node.mac_address || "Not configured"} /><Info label="Broadcast" value={node.wol_broadcast || "Not configured"} /></div>
                <div className="mt-5 flex gap-2 border-t border-white/10 pt-4">
                  <Button onClick={() => wake(node)} disabled={!ready || waking !== null}><Power className={waking === node.id ? "animate-pulse" : ""} />{waking === node.id ? "Sending..." : "Wake node"}</Button>
                  {!ready && <Button render={<Link href="/nodes" />} variant="outline"><Settings2 /> Configure</Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-sm">{value}</div></div>;
}
