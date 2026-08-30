"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Check, Loader2, ShieldCheck, Wifi, KeyRound, TerminalSquare, AlertTriangle } from "lucide-react";
import type { SshStatusCode, SshStatusEvent } from "@/lib/ssh/status";
import { cn } from "@/lib/utils";

interface DataMsg { sessionId: string; chunk: string }
interface ExitMsg { sessionId: string; reason: string }
interface ErrMsg { sessionId?: string; message: string; hint?: string }
interface OpenAck { ok: true; sessionId: string; startedAt: number }
interface OpenErr { ok: false; error: string; hint?: string }

const STEPS: Array<{ code: SshStatusCode; label: string }> = [
  { code: "resolving-node", label: "Resolve node" },
  { code: "auth-ready", label: "Prepare auth" },
  { code: "tcp-connecting", label: "Connect TCP/22" },
  { code: "ssh-ready", label: "SSH handshake" },
  { code: "pty-ready", label: "Allocate PTY" },
];

export function TerminalPane({
  tabKey,
  nodeId,
  socket,
  existingSessionId,
  initialBuffer,
  onSession,
  onExit,
  onError,
}: {
  tabKey: string;
  nodeId: string;
  socket: Socket;
  existingSessionId?: string;
  initialBuffer?: string;
  onSession: (sessionId: string) => void;
  onExit: (reason: string) => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [statuses, setStatuses] = useState<SshStatusEvent[]>([]);
  const [failed, setFailed] = useState<{ message: string; hint?: string } | null>(null);
  const [connected, setConnected] = useState(Boolean(existingSessionId));
  const [elapsedMs, setElapsedMs] = useState(0);

  const currentCode = statuses.at(-1)?.code;
  const progress = useMemo(() => {
    if (connected) return 100;
    const idx = STEPS.findIndex((s) => s.code === currentCode);
    return idx < 0 ? 8 : Math.round(((idx + 1) / STEPS.length) * 100);
  }, [connected, currentCode]);

  useEffect(() => {
    const startedAt = Date.now();
    const t = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 150);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: "#0a0a0a",
        foreground: "#e4e4e7",
        cursor: "#10b981",
      },
      scrollback: 5000,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    if (existingSessionId) {
      sessionIdRef.current = existingSessionId;
      if (initialBuffer) term.write(initialBuffer);
      term.writeln("\r\n\x1b[90m[omnigrid] reattached to existing SSH session…\x1b[0m");
    } else {
      term.writeln("\x1b[90m[omnigrid] opening SSH session…\x1b[0m");
    }

    const onStatus = (m: SshStatusEvent) => {
      if (m.nodeId !== nodeId) return;
      if (sessionIdRef.current && m.sessionId !== sessionIdRef.current) return;
      setStatuses((prev) => {
        if (prev.some((p) => p.code === m.code && p.sessionId === m.sessionId)) return prev;
        return [...prev, m];
      });
      term.writeln(
        `\x1b[36m[${new Date(m.at).toLocaleTimeString()}] ${m.label}` +
          `${m.detail ? ` — ${m.detail}` : ""}\x1b[0m`,
      );
    };
    const onData = (m: DataMsg) => {
      if (m.sessionId === sessionIdRef.current) term.write(m.chunk);
    };
    const onExitMsg = (m: ExitMsg) => {
      if (m.sessionId !== sessionIdRef.current) return;
      term.writeln(`\r\n\x1b[33m[session ended: ${m.reason}]\x1b[0m`);
      onExit(m.reason);
    };
    const onErrMsg = (m: ErrMsg) => {
      if (m.sessionId && m.sessionId !== sessionIdRef.current) return;
      setFailed({ message: m.message, hint: m.hint });
      term.writeln(`\r\n\x1b[31m[error] ${m.message}\x1b[0m`);
      if (m.hint) term.writeln(`\x1b[33m[hint] ${m.hint}\x1b[0m`);
      onError(m.message);
    };
    socket.on("status", onStatus);
    socket.on("data", onData);
    socket.on("exit", onExitMsg);
    socket.on("error", onErrMsg);

    if (!existingSessionId) {
      // Open session via socket after listeners are attached so fast status
      // events (resolve/auth) are not missed.
      socket.emit(
        "open",
        { nodeId, cols: term.cols, rows: term.rows },
        (ack: OpenAck | OpenErr) => {
          if (!ack.ok) {
            setFailed({ message: ack.error, hint: ack.hint });
            term.writeln(`\r\n\x1b[31m[connect failed] ${ack.error}\x1b[0m`);
            if (ack.hint) term.writeln(`\x1b[33m[hint] ${ack.hint}\x1b[0m`);
            onError(ack.error);
            return;
          }
          sessionIdRef.current = ack.sessionId;
          setConnected(true);
          onSession(ack.sessionId);
        },
      );
    }

    // Forward keystrokes
    const dataDisposable = term.onData((d) => {
      if (sessionIdRef.current) {
        socket.emit("input", { sessionId: sessionIdRef.current, data: d });
      }
    });

    // Resize handling — observe container size, refit, push to backend
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (sessionIdRef.current) {
          socket.emit("resize", {
            sessionId: sessionIdRef.current,
            cols: term.cols,
            rows: term.rows,
          });
        }
      } catch {}
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      dataDisposable.dispose();
      socket.off("status", onStatus);
      socket.off("data", onData);
      socket.off("exit", onExitMsg);
      socket.off("error", onErrMsg);
      term.dispose();
    };
    // tabKey is used to scope the effect to this pane instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey]);

  return (
    <div className="relative h-full w-full bg-black">
      {!connected && (
        <ConnectionOverlay
          statuses={statuses}
          currentCode={currentCode}
          failed={failed}
          progress={progress}
          elapsedMs={elapsedMs}
        />
      )}
      <div ref={containerRef} className="h-full w-full p-2" />
    </div>
  );
}

function ConnectionOverlay({
  statuses,
  currentCode,
  failed,
  progress,
  elapsedMs,
}: {
  statuses: SshStatusEvent[];
  currentCode?: SshStatusCode;
  failed: { message: string; hint?: string } | null;
  progress: number;
  elapsedMs: number;
}) {
  const doneCodes = new Set(statuses.map((s) => s.code));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-md">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
              {failed ? (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              <span className="absolute inset-0 animate-ping rounded-xl bg-cyan-400/10" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">
                {failed ? "Tailscale SSH connection failed" : "Connecting through Tailscale SSH"}
              </div>
              <div className="text-xs text-zinc-400">
                {failed
                  ? failed.message
                  : `${(elapsedMs / 1000).toFixed(1)}s elapsed · waiting for SSH ready`}
              </div>
            </div>
          </div>
          <div className="font-mono text-xs text-zinc-500">{progress}%</div>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              failed
                ? "bg-red-500"
                : "bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300",
            )}
            style={{ width: `${failed ? Math.max(progress, 20) : progress}%` }}
          />
        </div>

        <div className="grid grid-cols-5 gap-2">
          {STEPS.map((step) => {
            const done = doneCodes.has(step.code);
            const active = currentCode === step.code && !failed;
            const Icon =
              step.code === "auth-ready"
                ? KeyRound
                : step.code === "tcp-connecting"
                  ? Wifi
                  : step.code === "ssh-ready"
                    ? ShieldCheck
                    : step.code === "pty-ready"
                      ? TerminalSquare
                      : Check;
            return (
              <div
                key={step.code}
                className={cn(
                  "rounded-lg border p-2 transition-colors",
                  done
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : active
                      ? "border-cyan-500/50 bg-cyan-500/10"
                      : "border-zinc-800 bg-zinc-900/60",
                )}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      done ? "text-emerald-400" : active ? "text-cyan-300" : "text-zinc-600",
                    )}
                  />
                  <span className="truncate text-[11px] font-medium text-zinc-200">
                    {step.label}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500">
                  {done ? "done" : active ? "in progress" : "pending"}
                </div>
              </div>
            );
          })}
        </div>

        {failed?.hint && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <span className="font-semibold">Hint:</span> {failed.hint}
          </div>
        )}
      </div>
    </div>
  );
}
