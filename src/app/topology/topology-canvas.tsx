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
import type { NodeRow } from "@/lib/db/repos/nodes";
import type { CloudflareOverview } from "@/lib/cloudflare/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Terminal,
  Activity,
  X,
  ExternalLink,
  Shield,
  Layers,
  Network,
  Server,
  Cloud,
} from "lucide-react";
import { DeviceNode } from "./nodes/device-node";
import { HubNode } from "./nodes/hub-node";
import { FleetNode, type FleetNodeData } from "./nodes/fleet-node";
import { EdgeNode, type EdgeNodeData } from "./nodes/edge-node";
import { ControlPlaneNode } from "./nodes/control-plane-node";
import { OmnigridNetNode } from "./nodes/omnigrid-net-node";

const nodeTypes: NodeTypes = {
  device: DeviceNode,
  hub: HubNode,
  fleetNode: FleetNode,
  edgeNode: EdgeNode,
  controlPlane: ControlPlaneNode,
  omnigridNet: OmnigridNetNode,
};

export interface TopologyCanvasProps {
  nodes: NodeRow[];
  devices?: TailscaleDevice[];
  cloudflare?: CloudflareOverview | null;
}

function buildFleetGraph(nodes: NodeRow[], cloudflare?: CloudflareOverview | null): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  const hostCount = nodes.length;
  const tunnels = cloudflare?.tunnels ?? [];

  // 1. Control Plane Root Node (Left)
  flowNodes.push({
    id: "cp-root",
    type: "controlPlane",
    position: { x: 50, y: Math.max(100, (hostCount * 140) / 2 - 40) },
    data: { label: "OmniGrid Control Plane", hostCount },
    draggable: true,
  });

  // 2. Managed Nodes (Middle-Left Column)
  const nodeYSpacing = 160;
  nodes.forEach((node, i) => {
    const nodeY = 40 + i * nodeYSpacing;
    const hasActiveTunnel = tunnels.some((t) => t.status === "healthy" || t.status === "active");

    flowNodes.push({
      id: `host-${node.id}`,
      type: "fleetNode",
      position: { x: 380, y: nodeY },
      data: { node, tunnelConnected: hasActiveTunnel },
      draggable: true,
    });

    // Edge from Control Plane to Managed Node (SSH Port 22)
    flowEdges.push({
      id: `e-cp-${node.id}`,
      source: "cp-root",
      sourceHandle: "right",
      target: `host-${node.id}`,
      targetHandle: "ssh-in",
      animated: true,
      label: `SSH:${node.ssh_port}`,
      labelStyle: { fill: "#22d3ee", fontSize: 10, fontFamily: "monospace" },
      labelBgStyle: { fill: "#09090b", fillOpacity: 0.85 },
      style: { stroke: "#06b6d4", strokeWidth: 1.5, opacity: 0.75 },
    });

    // 3. omnigrid-net Bridge Network per node
    flowNodes.push({
      id: `net-${node.id}`,
      type: "omnigridNet",
      position: { x: 690, y: nodeY + 25 },
      data: { hostName: node.name, containerCount: 0 },
      draggable: true,
    });

    // Edge from Host to omnigrid-net
    flowEdges.push({
      id: `e-net-${node.id}`,
      source: `host-${node.id}`,
      sourceHandle: "tunnel-out",
      target: `net-${node.id}`,
      targetHandle: "host-in",
      style: { stroke: "#10b981", strokeWidth: 1.5, opacity: 0.8 },
    });
  });

  // 4. Cloudflare Edge Tunnels (Right Column)
  if (tunnels.length > 0) {
    tunnels.forEach((tunnel, i) => {
      const tunnelY = 40 + i * 180;
      flowNodes.push({
        id: `tunnel-${tunnel.id}`,
        type: "edgeNode",
        position: { x: 970, y: tunnelY },
        data: {
          tunnelName: tunnel.name,
          hostnames: tunnel.hostnames.map((h) => h.hostname),
          status: tunnel.status,
        },
        draggable: true,
      });

      // Connect all omnigrid-net bridges to the tunnel (Ingress connection)
      nodes.forEach((node) => {
        flowEdges.push({
          id: `e-tun-${node.id}-${tunnel.id}`,
          source: `net-${node.id}`,
          sourceHandle: "tunnel-out",
          target: `tunnel-${tunnel.id}`,
          targetHandle: "tunnel-in",
          animated: tunnel.status === "healthy",
          label: "Zero Trust Ingress",
          labelStyle: { fill: "#f97316", fontSize: 9, fontFamily: "monospace" },
          labelBgStyle: { fill: "#09090b", fillOpacity: 0.85 },
          style: { stroke: "#f97316", strokeWidth: 1.5, strokeDasharray: "4 4", opacity: 0.7 },
        });
      });
    });
  }

  return { nodes: flowNodes, edges: flowEdges };
}

function buildTailscaleGraph(devices: TailscaleDevice[]): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...devices].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.shortName.localeCompare(b.shortName);
  });

  const n = sorted.length || 1;
  const radius = Math.max(260, 80 + n * 28);
  const hubSize = 112;
  const cx = 0;
  const cy = 0;

  const flowNodes: Node[] = [
    {
      id: "__tailnet",
      type: "hub",
      position: { x: cx - hubSize / 2, y: cy - hubSize / 2 },
      data: { label: "Tailnet Mesh", count: devices.length },
      draggable: false,
      selectable: false,
    },
  ];
  const flowEdges: Edge[] = [];

  sorted.forEach((d, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    let sourceHandle: string | undefined;
    if (angle >= -Math.PI / 4 && angle < Math.PI / 4) sourceHandle = undefined;
    else if (angle >= Math.PI / 4 && angle < (3 * Math.PI) / 4) sourceHandle = "bottom";
    else if (angle >= -(3 * Math.PI) / 4 && angle < -Math.PI / 4) sourceHandle = "top";
    else sourceHandle = "left";

    flowNodes.push({
      id: d.id,
      type: "device",
      position: { x: x - 90, y: y - 24 },
      data: { device: d },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    });
    flowEdges.push({
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

  return { nodes: flowNodes, edges: flowEdges };
}

export function TopologyCanvas({ nodes: fleetNodes, devices = [], cloudflare }: TopologyCanvasProps) {
  const router = useRouter();
  const hasTailscale = devices.length > 0;
  const [viewMode, setViewMode] = useState<"fleet" | "tailscale">("fleet");
  const [selectedNode, setSelectedNode] = useState<NodeRow | null>(null);
  const [selectedEdgeData, setSelectedEdgeData] = useState<EdgeNodeData | null>(null);

  const { nodes, edges } = useMemo(() => {
    if (viewMode === "tailscale" && hasTailscale) {
      return buildTailscaleGraph(devices);
    }
    return buildFleetGraph(fleetNodes, cloudflare);
  }, [viewMode, hasTailscale, devices, fleetNodes, cloudflare]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === "fleetNode") {
      const data = node.data as unknown as FleetNodeData;
      setSelectedNode(data.node);
      setSelectedEdgeData(null);
    } else if (node.type === "edgeNode") {
      const data = node.data as unknown as EdgeNodeData;
      setSelectedEdgeData(data);
      setSelectedNode(null);
    } else {
      setSelectedNode(null);
      setSelectedEdgeData(null);
    }
  }, []);

  const totalPublishedHostnames = useMemo(() => {
    return cloudflare?.tunnels.reduce((acc, t) => acc + t.hostnames.length, 0) ?? 0;
  }, [cloudflare]);

  return (
    <div className="relative h-full w-full bg-zinc-950">
      {/* Top Floating Control Bar */}
      <div className="absolute left-6 top-4 z-20 flex items-center gap-3">
        <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 backdrop-blur-md">
          <Button
            variant={viewMode === "fleet" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs font-medium"
            onClick={() => {
              setViewMode("fleet");
              setSelectedNode(null);
              setSelectedEdgeData(null);
            }}
          >
            <Shield className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
            Zero Trust Fleet ({fleetNodes.length})
          </Button>
          {hasTailscale && (
            <Button
              variant={viewMode === "tailscale" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => {
                setViewMode("tailscale");
                setSelectedNode(null);
                setSelectedEdgeData(null);
              }}
            >
              <Network className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              Tailscale Mesh ({devices.length})
            </Button>
          )}
        </div>

        {viewMode === "fleet" && (
          <div className="hidden md:flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-md">
            <span>{fleetNodes.length} Hosts</span>
            <span>·</span>
            <span className="text-orange-300 font-mono">{cloudflare?.tunnels.length ?? 0} Tunnels</span>
            <span>·</span>
            <span className="text-emerald-300 font-mono">{totalPublishedHostnames} Published Apps</span>
          </div>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        className="bg-zinc-950"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
        <Controls className="!bg-zinc-900 !border-zinc-800 !fill-zinc-400 [&>button]:!border-zinc-800" />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "controlPlane") return "#06b6d4";
            if (n.type === "fleetNode") return "#38bdf8";
            if (n.type === "edgeNode") return "#f97316";
            if (n.type === "omnigridNet") return "#10b981";
            return "#71717a";
          }}
          className="!bg-zinc-900/90 !border-zinc-800"
        />
      </ReactFlow>

      {/* Selected Fleet Node Drawer */}
      {selectedNode && (
        <Card className="absolute right-6 top-4 z-20 w-84 border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-400" />
              <CardTitle className="text-sm font-semibold text-white">{selectedNode.name}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-400 hover:text-white"
              onClick={() => setSelectedNode(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-800">
              <span className="text-zinc-400">Hostname / IP:</span>
              <span className="font-mono text-white">{selectedNode.hostname}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800">
              <span className="text-zinc-400">SSH Port:</span>
              <span className="font-mono text-cyan-300">{selectedNode.ssh_port} (Protected)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800">
              <span className="text-zinc-400">SSH User & Mode:</span>
              <span className="font-mono text-zinc-200">{selectedNode.ssh_user ?? "root"} ({selectedNode.ssh_mode})</span>
            </div>
            {selectedNode.mac_address && (
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-400">WoL MAC:</span>
                <span className="font-mono text-zinc-300">{selectedNode.mac_address}</span>
              </div>
            )}

            <div className="mt-2 flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-medium"
                onClick={() => router.push(`/terminal?nodeId=${selectedNode.id}`)}
              >
                <Terminal className="h-3.5 w-3.5" />
                Launch Web Terminal
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-1.5"
                  onClick={() => router.push(`/containers`)}
                >
                  <Layers className="h-3.5 w-3.5 text-emerald-400" />
                  Containers
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-1.5"
                  onClick={() => router.push(`/runbooks`)}
                >
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  Runbooks
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Edge / Tunnel Drawer */}
      {selectedEdgeData && (
        <Card className="absolute right-6 top-4 z-20 w-84 border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-orange-400" />
              <CardTitle className="text-sm font-semibold text-white">{selectedEdgeData.tunnelName}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-400 hover:text-white"
              onClick={() => setSelectedEdgeData(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-zinc-800">
              <span className="text-zinc-400">Tunnel Status:</span>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                {selectedEdgeData.status}
              </Badge>
            </div>
            <div>
              <span className="text-zinc-400 font-medium">Published Hostnames:</span>
              <div className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {selectedEdgeData.hostnames.length === 0 ? (
                  <span className="text-zinc-500 italic">No hostnames configured yet.</span>
                ) : (
                  selectedEdgeData.hostnames.map((h) => (
                    <a
                      key={h}
                      href={`https://${h}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg bg-zinc-800/80 px-2.5 py-1.5 font-mono text-cyan-300 hover:bg-zinc-800 transition"
                    >
                      <span className="truncate">{h}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400" />
                    </a>
                  ))
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-1.5"
              onClick={() => router.push(`/tunnels`)}
            >
              <ExternalLink className="h-3.5 w-3.5 text-orange-400" />
              Manage in Tunnels Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
