import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { getTailnet } from "@/lib/tailscale/client";
import { TopologyCanvas } from "./topology-canvas";

export const dynamic = "force-dynamic";

export default async function TopologyPage() {
  const snapshot = await getTailnet().catch(() => null);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title="Topology"
        description="Live view of your tailnet. Click a node for actions."
        actions={
          snapshot && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={snapshot.source === "api" ? "default" : "secondary"}>
                {snapshot.source}
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
          <div className="grid h-full place-items-center text-sm text-destructive">
            Failed to load Tailscale snapshot.
          </div>
        )}
      </div>
    </div>
  );
}
