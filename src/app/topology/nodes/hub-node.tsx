"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Network } from "lucide-react";

export const HubNode = memo(function HubNode({ data }: { data: { label: string; count: number } }) {
  return (
    <div className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-cyan-400 to-sky-500 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-emerald-500/0"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!h-2 !w-2 !border-0 !bg-emerald-500/0"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!h-2 !w-2 !border-0 !bg-emerald-500/0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!h-2 !w-2 !border-0 !bg-emerald-500/0"
      />
      <div className="flex flex-col items-center text-black">
        <Network className="h-5 w-5" />
        <span className="mt-1 text-[11px] font-semibold tracking-wide">{data.label}</span>
        <span className="text-[10px] font-mono opacity-70">{data.count} devices</span>
      </div>
    </div>
  );
});
