import type { Server as IOServer, Socket } from "socket.io";
import { closeSession, openSession, resizeSession, writeToSession } from "./manager";
import { explainSshError } from "@/lib/ssh/status";

/**
 * /ssh namespace protocol
 *
 *   client → server
 *     "open"   { nodeId, cols, rows }      ack: { ok, sessionId? , error?, hint? }
 *     "input"  { sessionId, data }
 *     "resize" { sessionId, cols, rows }
 *     "close"  { sessionId }
 *
 *   server → client
 *     "data"   { sessionId, chunk }
 *     "status" { sessionId?, nodeId, code, label, detail?, at }
 *     "exit"   { sessionId, reason }
 *     "error"  { sessionId?, message, hint? }
 *
 * One socket can host multiple sessions (tabs). Sessions are auto-closed when
 * the socket disconnects so we never leak a backend ssh connection.
 */

interface OpenPayload { nodeId: string; cols: number; rows: number }
interface InputPayload { sessionId: string; data: string }
interface ResizePayload { sessionId: string; cols: number; rows: number }
interface ClosePayload { sessionId: string }

function getActor(socket: Socket): string {
  // TODO M-auth: replace with Tailscale `whois` lookup of socket.handshake.address
  // For now derive a stable label from the connection so the audit log is
  // never empty.
  const headers = socket.handshake.headers;
  const fwd = (headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return fwd || socket.handshake.address || "anonymous@local";
}

export function attachSshNamespace(io: IOServer): void {
  const ns = io.of("/ssh");

  ns.on("connection", (socket) => {
    const actor = getActor(socket);
    const ownedSessions = new Set<string>();

    socket.on("open", async (payload: OpenPayload, ack?: (r: unknown) => void) => {
      let pendingSessionId: string | undefined;
      try {
        const info = await openSession({
          nodeId: payload.nodeId,
          actor,
          cols: payload.cols || 80,
          rows: payload.rows || 24,
          handlers: {
            onData: (chunk) => socket.emit("data", { sessionId: pendingSessionId, chunk }),
            onClose: (reason) => {
              if (pendingSessionId) ownedSessions.delete(pendingSessionId);
              socket.emit("exit", { sessionId: pendingSessionId, reason });
            },
            onError: (message) =>
              socket.emit("error", {
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
        ownedSessions.add(info.id);
        ack?.({ ok: true, sessionId: info.id, startedAt: info.startedAt });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown error";
        ack?.({ ok: false, error: msg, hint: explainSshError(msg) });
      }
    });

    socket.on("input", (p: InputPayload) => {
      if (!ownedSessions.has(p.sessionId)) return;
      writeToSession(p.sessionId, p.data);
    });

    socket.on("resize", (p: ResizePayload) => {
      if (!ownedSessions.has(p.sessionId)) return;
      resizeSession(p.sessionId, p.cols, p.rows);
    });

    socket.on("close", (p: ClosePayload) => {
      if (!ownedSessions.has(p.sessionId)) return;
      closeSession(p.sessionId, "user-close");
      ownedSessions.delete(p.sessionId);
    });

    socket.on("disconnect", () => {
      for (const id of ownedSessions) closeSession(id, "socket-disconnect");
      ownedSessions.clear();
    });
  });
}
