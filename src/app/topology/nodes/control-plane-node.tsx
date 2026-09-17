"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { ShieldCheck, Cpu } from "lucide-react";

export interface ControlPlaneNodeData {
  label: string;
  hostCount: number;
}

export const ControlPlaneNode = memo(function ControlPlaneNode({ data }: { data: ControlPlaneNodeData }) {
  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-cyan-400/40 bg-zinc-950/90 px-5 py-4 shadow-[0_0_30px_rgba(6,182,212,0.25)] backdrop-blur-md">
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!h-2.5 !w-2.5 !border-0 !bg-cyan-400"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!h-2.5 !w-2.5 !border-0 !bg-cyan-400"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!h-2.5 !w-2.5 !border-0 !bg-cyan-400"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!h-2.5 !w-2.5 !border-0 !bg-cyan-400"
      />
      <div className="flex items-center gap-2 text-cyan-400">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-400/10">
          <Cpu className="h-4 w-4" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-white">OmniGrid</span>
          <span className="ml-1 text-[10px] text-cyan-300 font-mono">Control Plane</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-full bg-cyan-400/10 px-2.5 py-0.5 text-[10px] text-cyan-200">
        <ShieldCheck className="h-3 w-3 text-cyan-400" />
        <span>Port 22 Protected Fleet ({data.hostCount} Hosts)</span>
      </div>
    </div>
  );
});
