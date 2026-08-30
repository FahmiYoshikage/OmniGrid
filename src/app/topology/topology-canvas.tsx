"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
  Position,
} from "@xyflow/react";
import type { TailscaleDevice } from "@/lib/tailscale/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Activity, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { DeviceNode } from "./nodes/device-node";
import { HubNode } from "./nodes/hub-node";

const nodeTypes: NodeTypes = {
  device: DeviceNode,
  hub: HubNode,
};

/**
 * Radial layout, sorted so online devices land on the top half (visually
 * dominant) and offline ones fall to the bottom. Each device chooses the
 * nearest hub handle (top/right/bottom/left) so edges leave the hub on the
 * correct side and don't crisscross.
 */
function buildGraph(devices: TailscaleDevice[]): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...devices].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.shortName.localeCompare(b.shortName);
  });

  const n = sorted.length || 1;
  const radius = Math.max(260, 80 + n * 28);
  const hubSize = 112; // matches HubNode h-28/w-28
  const cx = 0;
  const cy = 0;

  const nodes: Node[] = [
    {
      id: "__tailnet",
      type: "hub",
      position: { x: cx - hubSize / 2, y: cy - hubSize / 2 },
      data: { label: "Tailnet", count: devices.length },
      draggable: false,
      selectable: false,
    },
  ];
  const edges: Edge[] = [];

  sorted.forEach((d, i) => {
    // Start at top (-π/2), go clockwise.
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    // Choose hub-side based on angle quadrant.
    let sourceHandle: string | undefined;
    if (angle >= -Math.PI / 4 && angle < Math.PI / 4) sourceHandle = undefined; // right (default)
    else if (angle >= Math.PI / 4 && angle < (3 * Math.PI) / 4) sourceHandle = "bottom";
    else if (angle >= -(3 * Math.PI) / 4 && angle < -Math.PI / 4) sourceHandle = "top";
    else sourceHandle = "left";

    nodes.push({
      id: d.id,
      type: "device",
      position: { x: x - 90, y: y - 24 }, // approximate centring
      data: { device: d },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    });
    edges.push({
      id: `e-${d.id}`,
      source: "__tailnet",
      sourceHandle,
      target: d.id,
      animated: d.online,
      style: {
        stroke: d.online ? "#10b981" : "#3f3f46",
        strokeWidth: d.online ? 1.5 : 1,
        opacity: d.online ? 0.85 : 0.4,
      },
    });
  });

  return { nodes, edges };
}

export function TopologyCanvas({ devices }: { devices: TailscaleDevice[] }) {
  const { nodes, edges } = useMemo(() => buildGraph(devices), [devices]);
  const [selected, setSelected] = useState<TailscaleDevice | null>(null);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.type !== "device") return;
    const dev = (node.data as { device?: TailscaleDevice }).device;
    if (dev) setSelected(dev);
  }, []);

  return (
    <div className="relative h-full w-full bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.8}
        panOnScroll
        defaultEdgeOptions={{ type: "smoothstep" }}
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="#27272a"
        />
        <Controls
          className="!rounded-md !border-zinc-800 !bg-zinc-900 [&>button]:!border-zinc-800 [&>button]:!bg-zinc-900 [&>button]:!text-zinc-300 [&>button:hover]:!bg-zinc-800"
          showInteractive={false}
        />
        <MiniMap
          pannable
          zoomable
          className="!rounded-md !border !border-zinc-800 !bg-zinc-900"
          maskColor="rgba(0,0,0,0.6)"
          nodeBorderRadius={8}
          nodeColor={(n) => {
            if (n.type === "hub") return "#10b981";
            const d = (n.data as { device?: TailscaleDevice }).device;
            return d?.online ? "#34d399" : "#52525b";
          }}
        />
      </ReactFlow>

      {selected && <DetailPanel device={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DetailPanel({
  device,
  onClose,
}: {
  device: TailscaleDevice;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <div className="absolute right-4 top-4 z-10 w-80">
      <Card className="border-zinc-800 bg-zinc-900/95 backdrop-blur">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-sm">{device.shortName}</CardTitle>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{device.name}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="-m-2 h-7 w-7"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={device.online ? "default" : "secondary"}>
              {device.online ? "online" : "offline"}
            </Badge>
            <Badge variant="outline">{device.os}</Badge>
            {device.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
          <KV label="Tailscale IP" value={device.tailscaleIp} copyable />
          <KV label="User" value={device.user} />
          <KV
            label="Last seen"
            value={
              device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "—"
            }
          />
          {device.clientVersion && <KV label="Client" value={device.clientVersion} />}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                 router.push("/terminal");
              }}
            >
              <Terminal className="h-4 w-4" /> Open terminal
            </Button>
            <Button size="sm" variant="outline" disabled className="flex-1">
              <Activity className="h-4 w-4" /> Metrics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-mono text-xs">
        {value}
        {copyable && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success("Copied");
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Copy"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
}
