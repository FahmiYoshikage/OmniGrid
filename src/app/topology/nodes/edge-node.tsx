"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Lock, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EdgeNodeData {
  tunnelName: string;
  hostnames: string[];
  status: string;
  [key: string]: unknown;
}

export const EdgeNode = memo(function EdgeNode({
  data,
  selected,
}: NodeProps) {
  const { tunnelName, hostnames, status } = data as unknown as EdgeNodeData;
  const isHealthy = status === "healthy" || status === "active";

  return (
    <div
      className={cn(
        "group relative flex min-w-[200px] flex-col rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-sm transition-all",
        "border-orange-500/30 bg-zinc-900/90 text-zinc-100 hover:border-orange-500/50",
        selected && "ring-2 ring-orange-400 ring-offset-2 ring-offset-zinc-950",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="tunnel-in"
        className="!h-2.5 !w-2.5 !border-0 !bg-emerald-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="edge-out"
        className="!h-2.5 !w-2.5 !border-0 !bg-orange-400"
      />

      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-500/15 text-orange-400">
          <Cloud className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="truncate text-[13px] font-semibold tracking-tight text-white">
            {tunnelName}
          </span>
          <span className="text-[10px] text-orange-300/80 font-mono">
            Cloudflare Zero Trust
          </span>
        </div>
        <span
          className={cn(
            "ml-auto h-2 w-2 rounded-full",
            isHealthy ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-zinc-600",
          )}
        />
      </div>

      <div className="mt-2.5 flex flex-col gap-1 pt-2 border-t border-zinc-800/80 text-[10px]">
        {hostnames.slice(0, 3).map((h) => (
          <div key={h} className="flex items-center gap-1.5 text-zinc-300 font-mono truncate">
            <Lock className="h-2.5 w-2.5 text-orange-400 shrink-0" />
            <span className="truncate">{h}</span>
          </div>
        ))}
        {hostnames.length > 3 && (
          <span className="text-[9px] text-zinc-500 font-sans">
            +{hostnames.length - 3} more published hostnames
          </span>
        )}
      </div>
    </div>
  );
});
