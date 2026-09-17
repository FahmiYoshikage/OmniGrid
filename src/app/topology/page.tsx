import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { getTailnet } from "@/lib/tailscale/client";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { getCloudflareOverview } from "@/lib/cloudflare/client";
import { TopologyCanvas } from "./topology-canvas";
import { requireSessionUser } from "@/lib/auth/access";
import { Server, PlusCircle, Shield } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TopologyPage() {
  const user = await requireSessionUser();

  const [nodes, snapshot, cloudflare] = await Promise.all([
    Promise.resolve(nodesRepo.list(user.workspaceId)).catch(() => []),
    getTailnet({ workspaceId: user.workspaceId }).catch(() => null),
    getCloudflareOverview(user.workspaceId).catch(() => null),
  ]);

  const hasContent = nodes.length > 0 || (snapshot && snapshot.devices.length > 0);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title="Fleet Topology"
        description="Interactive Zero Trust architecture graph: Control Plane, Port 22 SSH hosts, omnigrid-net, and Cloudflare Tunnels."
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
              <Shield className="mr-1 h-3 w-3" />
              OmniGrid Standard
            </Badge>
            <span>{nodes.length} Managed Hosts</span>
            {snapshot && (
              <>
                <span>·</span>
                <Badge variant="secondary" className="text-xs">
                  Tailscale Mesh Active
                </Badge>
              </>
            )}
          </div>
        }
      />
      <div className="flex-1">
        {hasContent ? (
          <TopologyCanvas
            nodes={nodes}
            devices={snapshot?.devices ?? []}
            cloudflare={cloudflare}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <Server className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">No Managed Hosts in Fleet</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Register your first Linux host in OmniGrid to visualize your Zero Trust fleet topology, secure SSH channels, and published container workloads.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/nodes"
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add New Node
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Bootstrap Guide
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
