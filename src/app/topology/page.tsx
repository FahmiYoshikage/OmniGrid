import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { getTailnet } from "@/lib/tailscale/client";
import { TopologyCanvas } from "./topology-canvas";
import { requireSessionUser } from "@/lib/auth/access";
import { Settings } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TopologyPage() {
  const user = await requireSessionUser();
  const snapshot = await getTailnet({ workspaceId: user.workspaceId }).catch(() => null);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title="Topology"
        description="Live view of your tailnet. Click a node for actions."
        actions={
          snapshot && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="default">
                Tailscale API
              </Badge>
              <span>{snapshot.devices.length} devices</span>
              <span>·</span>
              <span>refreshed {new Date(snapshot.fetchedAt).toLocaleTimeString()}</span>
            </div>
          )
        }
      />
      <div className="flex-1">
        {snapshot ? (
          <TopologyCanvas devices={snapshot.devices} />
        ) : (
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <Settings className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Tailscale not configured</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Add your Tailscale API key and tailnet in Settings to visualize your network topology.
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300/15 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/25"
              >
                <Settings className="h-3 w-3" />
                Go to Settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
