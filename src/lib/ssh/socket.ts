import type { Server as IOServer, Socket } from "socket.io";
import { z } from "zod";
import { getSessionUserFromCookieHeader, type SessionUser } from "@/lib/auth/session";
import {
  cancelRunbook,
  closeSession,
  openSession,
  resizeSession,
  runRunbook,
  writeToSession,
} from "./manager";
import { explainSshError } from "@/lib/ssh/status";
import { rateLimit } from "@/lib/security/request";
import { hasPermission } from "@/lib/auth/permissions";

/**
 * /ssh namespace protocol
 *
 *   client -> server
 *     "open"            { nodeId, cols, rows }       ack: { ok, sessionId?, error?, hint? }
 *     "input"           { sessionId, data }
 *     "resize"          { sessionId, cols, rows }
 *     "close"           { sessionId }
 *     "runbook:run"     { runbookId, nodeId }        ack: { ok, runId?, startedAt?, error? }
 *     "runbook:cancel"  { runId }                    ack: { ok }
 *
 *   server -> client
 *     "data"            { sessionId, chunk }
 *     "status"          { sessionId?, nodeId, code, label, detail?, at }
 *     "exit"            { sessionId, reason }
 *     "error"           { sessionId?, message, hint? }
 *     "runbook:output"  { runId, stream, chunk }
 *     "runbook:status"  { runId, nodeId, runbookId, status, at }
 *     "runbook:exit"    { runId, code, signal, reason, at }
 *     "runbook:error"   { runId?, message }
 */

const OpenSchema = z.object({
  nodeId: z.string().uuid(),
  cols: z.number().int().min(1).max(1000).optional().default(80),
  rows: z.number().int().min(1).max(1000).optional().default(24),
}).strict();
const InputSchema = z.object({
  sessionId: z.string().uuid(),
  data: z.string().max(1_000_000),
}).strict();
const ResizeSchema = z.object({
  sessionId: z.string().uuid(),
  cols: z.number().int().min(1).max(1000),
  rows: z.number().int().min(1).max(1000),
}).strict();
const CloseSchema = z.object({ sessionId: z.string().uuid() }).strict();
const RunbookRunSchema = z.object({
  runbookId: z.string().uuid(),
  nodeId: z.string().uuid(),
}).strict();
const RunbookCancelSchema = z.object({ runId: z.string().uuid() }).strict();

type Ack = (response: unknown) => void;
type AuthenticatedSocket = Socket & { data: { user: SessionUser } };

function hasAllowedOrigin(socket: Socket): boolean {
  const origin = socket.handshake.headers.origin;
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const publicUrl = process.env.OMNIGRID_PUBLIC_URL;
    if (publicUrl) return originUrl.origin === new URL(publicUrl).origin;
    return originUrl.host === socket.handshake.headers.host;
  } catch {
    return false;
  }
}

function validationMessage(error: z.ZodError): string {
  return `Invalid payload: ${error.issues[0]?.message ?? "validation failed"}`;
}

export function attachSshNamespace(io: IOServer): void {
  const ns = io.of("/ssh");

  ns.use((socket, next) => {
    if (!hasAllowedOrigin(socket)) return next(new Error("Forbidden origin"));
    const user = getSessionUserFromCookieHeader(socket.handshake.headers.cookie);
    if (!user) return next(new Error("Unauthorized"));
    if (rateLimit(`socket-connect:${user.id}`, 20, 60_000)) return next(new Error("Too many connections"));
    socket.data.user = user;
    next();
  });

  ns.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { user } = socket.data;
    const actor = user.username;
    const ownedSessions = new Set<string>();
    const ownedRuns = new Set<string>();

    if (!hasPermission(user, "terminal.open")) {
      socket.disconnect(true);
      return;
    }

    socket.on("open", async (payload: unknown, ack?: Ack) => {
      if (ownedSessions.size >= 5 || rateLimit(`ssh-open:${user.id}`, 10, 60_000)) {
        return ack?.({ ok: false, error: "SSH session limit exceeded" });
      }
      const parsed = OpenSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: validationMessage(parsed.error) });

      let pendingSessionId: string | undefined;
      try {
        const info = await openSession({
          ...parsed.data,
          workspaceId: user.workspaceId,
          actor,
          handlers: {
            onData: (chunk) => socket.emit("data", { sessionId: pendingSessionId, chunk }),
            onClose: (reason) => {
              if (pendingSessionId) ownedSessions.delete(pendingSessionId);
              socket.emit("exit", { sessionId: pendingSessionId, reason });
            },
            onError: (message) => socket.emit("error", {
              sessionId: pendingSessionId,
              message,
              hint: explainSshError(message),
            }),
            onStatus: (event) => {
              pendingSessionId = event.sessionId;
              socket.emit("status", event);
            },
          },
        });
        pendingSessionId = info.id;
        if (!socket.connected) {
          closeSession(info.id, user.workspaceId, "socket-disconnect");
          return;
        }
        ownedSessions.add(info.id);
        ack?.({ ok: true, sessionId: info.id, startedAt: info.startedAt });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        ack?.({ ok: false, error: message, hint: explainSshError(message) });
      }
    });

    socket.on("input", (payload: unknown) => {
      const parsed = InputSchema.safeParse(payload);
      if (!parsed.success || !ownedSessions.has(parsed.data.sessionId)) return;
      const units = Math.max(1, Math.ceil(parsed.data.data.length / 4096));
      for (let index = 0; index < units; index++) {
        if (rateLimit(`ssh-input:${user.id}`, 2_000, 60_000)) {
          socket.emit("error", { sessionId: parsed.data.sessionId, message: "SSH input rate limit exceeded" });
          return;
        }
      }
      writeToSession(parsed.data.sessionId, user.workspaceId, parsed.data.data);
    });

    socket.on("resize", (payload: unknown) => {
      const parsed = ResizeSchema.safeParse(payload);
      if (!parsed.success || !ownedSessions.has(parsed.data.sessionId)) return;
      resizeSession(parsed.data.sessionId, user.workspaceId, parsed.data.cols, parsed.data.rows);
    });

    socket.on("close", (payload: unknown) => {
      const parsed = CloseSchema.safeParse(payload);
      if (!parsed.success || !ownedSessions.has(parsed.data.sessionId)) return;
      closeSession(parsed.data.sessionId, user.workspaceId, "user-close");
      ownedSessions.delete(parsed.data.sessionId);
    });

    socket.on("runbook:run", async (payload: unknown, ack?: Ack) => {
      if (!hasPermission(user, "runbooks.execute")) return ack?.({ ok: false, error: "Forbidden" });
      if (ownedRuns.size >= 3 || rateLimit(`runbook-run:${user.id}`, 10, 60_000)) {
        return ack?.({ ok: false, error: "Runbook execution limit exceeded" });
      }
      const parsed = RunbookRunSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: validationMessage(parsed.error) });

      try {
        const info = await runRunbook({
          ...parsed.data,
          workspaceId: user.workspaceId,
          actor,
          handlers: {
            onOutput: (runId, stream, chunk) => socket.emit("runbook:output", { runId, stream, chunk }),
            onStatus: (runId, status) => socket.emit("runbook:status", {
              runId,
              ...parsed.data,
              status,
              at: Date.now(),
            }),
            onExit: (runId, exit) => {
              ownedRuns.delete(runId);
              socket.emit("runbook:exit", { runId, ...exit, at: Date.now() });
            },
            onError: (runId, message) => socket.emit("runbook:error", { runId, message }),
          },
        });
        if (!socket.connected) {
          cancelRunbook(info.id, user.workspaceId, "socket-disconnect");
          return;
        }
        ownedRuns.add(info.id);
        ack?.({ ok: true, runId: info.id, startedAt: info.startedAt });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        ack?.({ ok: false, error: message });
      }
    });

    socket.on("runbook:cancel", (payload: unknown, ack?: Ack) => {
      const parsed = RunbookCancelSchema.safeParse(payload);
      if (!parsed.success || !ownedRuns.has(parsed.data.runId)) return ack?.({ ok: false });
      const cancelled = cancelRunbook(parsed.data.runId, user.workspaceId, "user-cancel");
      ownedRuns.delete(parsed.data.runId);
      ack?.({ ok: cancelled });
    });

    socket.on("disconnect", () => {
      for (const id of ownedSessions) closeSession(id, user.workspaceId, "socket-disconnect");
      for (const id of ownedRuns) cancelRunbook(id, user.workspaceId, "socket-disconnect");
      ownedSessions.clear();
      ownedRuns.clear();
    });
  });
}
