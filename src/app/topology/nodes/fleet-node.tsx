"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Server, Shield, Key, Wifi } from "lucide-react";
import type { NodeRow } from "@/lib/db/repos/nodes";
import { cn } from "@/lib/utils";

export interface FleetNodeData {
  node: NodeRow;
  tunnelConnected?: boolean;
  containerCount?: number;
  [key: string]: unknown;
}

export const FleetNode = memo(function FleetNode({
  data,
  selected,
}: NodeProps) {
  const node = (data as unknown as FleetNodeData).node;
  const tunnelConnected = (data as unknown as FleetNodeData).tunnelConnected;
  const isOnline = true; // Registered nodes are reachable via port 22

  return (
    <div
      className={cn(
        "group relative flex min-w-[220px] flex-col rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-sm transition-all",
        "border-zinc-800 bg-zinc-900/90 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900",
        selected && "ring-2 ring-cyan-400 ring-offset-2 ring-offset-zinc-950",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="ssh-in"
        className="!h-2.5 !w-2.5 !border-0 !bg-cyan-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="tunnel-out"
        className="!h-2.5 !w-2.5 !border-0 !bg-emerald-400"
      />

      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-800 text-cyan-300">
          <Server className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="truncate text-[13px] font-semibold tracking-tight text-white">
            {node.name}
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {node.hostname}:{node.ssh_port}
          </span>
        </div>
        <span
          className={cn(
            "ml-auto h-2 w-2 rounded-full",
            isOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-zinc-600",
          )}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-400">
        <span className="inline-flex items-center gap-1 rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono">
          <Shield className="h-2.5 w-2.5 text-cyan-400" />
          SSH:{node.ssh_port}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-zinc-800/80 px-1.5 py-0.5">
          <Key className="h-2.5 w-2.5 text-zinc-400" />
          {node.ssh_mode}
        </span>
        {tunnelConnected && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300 font-medium">
            <Wifi className="h-2.5 w-2.5 text-emerald-400" />
            Tunnel Active
          </span>
        )}
      </div>
    </div>
  );
});
