"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { X, Plus, Server } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TerminalPane } from "./terminal-pane";

type TabStatus = "connecting" | "connected" | "error" | "closed";

export interface NodeOption {
  id: string;
  name: string;
  hostname: string;
  ssh_mode: string;
}

interface Tab {
  key: string;            // local id
  nodeId: string;
  label: string;
  sessionId?: string;     // assigned after server "open" ack
  status: TabStatus;
}

let persistedTabs: Tab[] = [];
let persistedActive: string | null = null;
let persistedCounter = 0;
const sessionBuffers = new Map<string, string>();
let socketListenersAttached = false;

let socketSingleton: Socket | null = null;
function getSocket(): Socket {
  if (!socketSingleton) {
    socketSingleton = io("/ssh", { path: "/socket.io", transports: ["websocket", "polling"] });
  }
  if (!socketListenersAttached) {
    socketListenersAttached = true;
    socketSingleton.on("data", (m: { sessionId: string; chunk: string }) => {
      const next = (sessionBuffers.get(m.sessionId) ?? "") + m.chunk;
      sessionBuffers.set(m.sessionId, next.length > 200_000 ? next.slice(-200_000) : next);
    });
  }
  return socketSingleton;
}

export function TerminalWorkspace({
  nodes,
  initialNodeId,
}: {
  nodes: NodeOption[];
  initialNodeId?: string;
}) {
  const [tabs, setTabs] = useState<Tab[]>(persistedTabs);
  const [active, setActive] = useState<string | null>(persistedActive);
  const [pendingNodeId, setPendingNodeId] = useState<string>("");
  const tabKeyRef = useRef(persistedCounter);
  const openedInitialRef = useRef(false);

  function openTab(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const key = `t-${++tabKeyRef.current}`;
    persistedCounter = tabKeyRef.current;
    setTabs((t) => [...t, { key, nodeId, label: node.name, status: "connecting" }]);
    setActive(key);
  }

  useEffect(() => {
    persistedTabs = tabs;
    persistedActive = active;
  }, [tabs, active]);

  useEffect(() => {
    if (openedInitialRef.current || !initialNodeId) return;
    if (!nodes.some((n) => n.id === initialNodeId)) return;
    openedInitialRef.current = true;
    openTab(initialNodeId);
  }, [initialNodeId, nodes]);

  function closeTab(key: string) {
    const tab = tabs.find((x) => x.key === key);
    if (tab?.sessionId) {
      getSocket().emit("close", { sessionId: tab.sessionId });
      sessionBuffers.delete(tab.sessionId);
    }
    setTabs((t) => {
      const next = t.filter((x) => x.key !== key);
      if (active === key) setActive(next[next.length - 1]?.key ?? null);
      return next;
    });
  }

  function setSessionId(key: string, sessionId: string) {
    setTabs((t) => t.map((x) => (x.key === key ? { ...x, sessionId, status: "connected" } : x)));
  }

  function setTabStatus(key: string, status: TabStatus) {
    setTabs((t) => t.map((x) => (x.key === key ? { ...x, status } : x)));
  }

  if (nodes.length === 0) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Add a node on the <span className="font-mono mx-1">/nodes</span> page first.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-card/40 px-3 py-2">
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "group flex items-center gap-2 rounded-md border px-3 py-1 text-xs transition-colors",
                active === t.key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <Server className="h-3 w-3" />
              <StatusDot status={t.status} />
              <span className="font-mono">{t.label}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.key);
                }}
                className="opacity-50 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={pendingNodeId} onValueChange={(v) => setPendingNodeId(v ?? "")}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Select node…" />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.name}{" "}
                  <span className="text-muted-foreground">({n.ssh_mode})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!pendingNodeId}
            onClick={() => {
              if (pendingNodeId) {
                openTab(pendingNodeId);
                setPendingNodeId("");
              }
            }}
          >
            <Plus className="h-4 w-4" /> Open
          </Button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 bg-black">
        {tabs.length === 0 && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Pick a node above and click Open.
          </div>
        )}
        {tabs.map((t) => (
          <div
            key={t.key}
            className={cn(
              "absolute inset-0",
              active === t.key ? "block" : "hidden",
            )}
          >
            <TerminalPane
              tabKey={t.key}
              nodeId={t.nodeId}
              socket={getSocket()}
              existingSessionId={t.sessionId}
              initialBuffer={t.sessionId ? sessionBuffers.get(t.sessionId) : undefined}
              onSession={(sid: string) => setSessionId(t.key, sid)}
              onExit={(reason: string) => {
                setTabStatus(t.key, "closed");
                toast.message(`Session ended: ${reason}`);
              }}
              onError={(msg: string) => {
                setTabStatus(t.key, "error");
                toast.error(msg);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: TabStatus }) {
  const cls =
    status === "connected"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      : status === "connecting"
        ? "bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"
        : status === "error"
          ? "bg-red-500"
          : "bg-zinc-500";
  return <span className={cn("h-2 w-2 rounded-full", cls)} />;
}
