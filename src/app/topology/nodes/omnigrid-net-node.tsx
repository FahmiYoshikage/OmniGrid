"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Network, Box } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OmnigridNetNodeData {
  hostName: string;
  containerCount?: number;
  [key: string]: unknown;
}

export const OmnigridNetNode = memo(function OmnigridNetNode({
  data,
  selected,
}: NodeProps) {
  const { hostName, containerCount = 0 } = data as unknown as OmnigridNetNodeData;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg border px-3 py-2 shadow-md backdrop-blur-sm transition-all",
        "border-emerald-500/30 bg-zinc-950/85 text-zinc-200 hover:border-emerald-500/60",
        selected && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="host-in"
        className="!h-2 !w-2 !border-0 !bg-cyan-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="tunnel-out"
        className="!h-2 !w-2 !border-0 !bg-emerald-400"
      />

      <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-emerald-500/10 text-emerald-400">
        <Network className="h-3.5 w-3.5" />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[11px] font-semibold text-emerald-300">
          omnigrid-net
        </span>
        <span className="text-[9px] text-zinc-400">
          {hostName} bridge
        </span>
      </div>

      {containerCount > 0 && (
        <span className="ml-2 inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono text-zinc-300">
          <Box className="h-2.5 w-2.5 text-emerald-400" />
          {containerCount}
        </span>
      )}
    </div>
  );
});
