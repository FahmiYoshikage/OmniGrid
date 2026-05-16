"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Server,
  Monitor,
  Smartphone,
  HardDrive,
  Cloud,
  AlertCircle,
} from "lucide-react";
import type { TailscaleDevice } from "@/lib/tailscale/types";
import { cn } from "@/lib/utils";

function pickIcon(os: string, tags: string[]) {
  const lower = os.toLowerCase();
  if (tags.some((t) => /server/i.test(t))) return Server;
  if (lower.includes("ios") || lower.includes("android")) return Smartphone;
  if (lower.includes("mac") || lower.includes("windows")) return Monitor;
  if (tags.some((t) => /nas|storage/i.test(t))) return HardDrive;
  if (lower.includes("linux")) return Server;
  return Cloud;
}

export interface DeviceNodeData {
  device: TailscaleDevice;
  [key: string]: unknown;
}

export const DeviceNode = memo(function DeviceNode({
  data,
  selected,
}: NodeProps) {
  const d = (data as DeviceNodeData).device;
  const Icon = pickIcon(d.os, d.tags);
  const online = d.online;

  return (
    <div
      className={cn(
        "group relative flex min-w-[180px] items-center gap-3 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-sm transition-all",
        online
          ? "border-emerald-500/40 bg-zinc-900/95 text-zinc-100"
          : "border-zinc-700 bg-zinc-900/70 text-zinc-500",
        selected && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-emerald-500/60"
      />
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          online ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500",
        )}
      >
        {!d.authorized ? (
          <AlertCircle className="h-4 w-4 text-amber-400" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[13px] font-semibold tracking-tight">
          {d.shortName}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {d.tailscaleIp}
        </span>
      </div>
      <span
        className={cn(
          "absolute right-2 top-2 h-2 w-2 rounded-full",
          online ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-zinc-600",
        )}
      />
    </div>
  );
});
