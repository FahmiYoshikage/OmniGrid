import type { Server as IOServer, Socket } from "socket.io";
import { z } from "zod";
import { getSessionUserFromCookieHeader, type SessionUser } from "@/lib/auth/session";
import { workspacesRepo } from "@/lib/db/repos/workspaces";
import { jobsRepo } from "@/lib/jobs/repository";
import { rateLimit } from "@/lib/security/request";

/** Events published by workspace jobs and delivered through /operations. */
export interface OperationsEvent {
  workspaceId: string;
  jobId?: string;
  type: string;
  payload: unknown;
  at?: number;
}

export interface SequencedOperationsEvent extends OperationsEvent {
  sequence: number;
  at: number;
}

export interface OperationsEventPublisher {
  publish(event: OperationsEvent): SequencedOperationsEvent;
}

interface OperationsEventStore {
  publish(event: OperationsEvent): SequencedOperationsEvent;
  replay(workspaceId: string, afterSequence: number, jobId?: string): SequencedOperationsEvent[];
}

const SubscribeSchema = z.object({
  workspaceId: z.string().min(1).max(256),
  jobId: z.string().min(1).max(256).optional(),
  afterSequence: z.number().int().min(0).optional().default(0),
}).strict();
const UnsubscribeSchema = z.object({
  workspaceId: z.string().min(1).max(256),
  jobId: z.string().min(1).max(256).optional(),
}).strict();

const WORKSPACE_ROOM = (workspaceId: string) => `operations:workspace:${workspaceId}`;
const JOB_ROOM = (workspaceId: string, jobId: string) => `operations:job:${workspaceId}:${jobId}`;
const MAX_REPLAY_EVENTS = 1_000;

/** Small in-process history. A durable job store can replace this without changing the socket protocol. */
export function createOperationsEventStore(maxEvents = MAX_REPLAY_EVENTS): OperationsEventStore {
  const histories = new Map<string, { nextSequence: number; events: SequencedOperationsEvent[] }>();

  return {
    publish(event) {
      const history = histories.get(event.workspaceId) ?? { nextSequence: 0, events: [] };
      const sequenced = {
        ...event,
        sequence: ++history.nextSequence,
        at: event.at ?? Date.now(),
      };
      history.events.push(sequenced);
      if (history.events.length > maxEvents) history.events.splice(0, history.events.length - maxEvents);
      histories.set(event.workspaceId, history);
      return sequenced;
    },
    replay(workspaceId, afterSequence, jobId) {
      return (histories.get(workspaceId)?.events ?? []).filter((event) =>
        event.sequence > afterSequence && (jobId === undefined || event.jobId === jobId),
      );
    },
  };
}

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

type Ack = (response: unknown) => void;
type AuthenticatedSocket = Socket & { data: { user: SessionUser } };

export function attachOperationsNamespace(io: IOServer, store = createOperationsEventStore()): OperationsEventPublisher {
  const ns = io.of("/operations");

  ns.use((socket, next) => {
    if (!hasAllowedOrigin(socket)) return next(new Error("Forbidden origin"));
    const user = getSessionUserFromCookieHeader(socket.handshake.headers.cookie);
    if (!user) return next(new Error("Unauthorized"));
    if (rateLimit(`operations-connect:${user.id}`, 20, 60_000)) return next(new Error("Too many connections"));
    socket.data.user = user;
    next();
  });

  ns.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const subscriptions = new Set<string>();

    socket.on("subscribe", (payload: unknown, ack?: Ack) => {
      const parsed = SubscribeSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: validationMessage(parsed.error) });
      const { workspaceId, jobId, afterSequence } = parsed.data;
      if (!workspacesRepo.getMembership(workspaceId, socket.data.user.id)) {
        return ack?.({ ok: false, error: "Forbidden" });
      }
      if (jobId && !jobsRepo.get(jobId, workspaceId)) {
        return ack?.({ ok: false, error: "Not found" });
      }
      if (rateLimit(`operations-subscribe:${socket.data.user.id}`, 60, 60_000)) {
        return ack?.({ ok: false, error: "Subscription rate limit exceeded" });
      }

      const room = jobId ? JOB_ROOM(workspaceId, jobId) : WORKSPACE_ROOM(workspaceId);
      socket.join(room);
      subscriptions.add(room);
      const replay = store.replay(workspaceId, afterSequence, jobId);
      for (const event of replay) socket.emit("operations:event", event);
      ack?.({ ok: true, replayed: replay.length });
    });

    socket.on("unsubscribe", (payload: unknown, ack?: Ack) => {
      const parsed = UnsubscribeSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: validationMessage(parsed.error) });
      const { workspaceId, jobId } = parsed.data;
      if (!workspacesRepo.getMembership(workspaceId, socket.data.user.id)) {
        return ack?.({ ok: false, error: "Forbidden" });
      }
      if (jobId && !jobsRepo.get(jobId, workspaceId)) {
        return ack?.({ ok: false, error: "Not found" });
      }
      const room = jobId ? JOB_ROOM(workspaceId, jobId) : WORKSPACE_ROOM(workspaceId);
      socket.leave(room);
      subscriptions.delete(room);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => subscriptions.clear());
  });

  const publisher: OperationsEventPublisher = {
    publish(event) {
      const sequenced = store.publish(event);
      const workspaceRoom = WORKSPACE_ROOM(event.workspaceId);
      const target = event.jobId
        ? ns.to(workspaceRoom).to(JOB_ROOM(event.workspaceId, event.jobId))
        : ns.to(workspaceRoom);
      target.emit("operations:event", sequenced);
      return sequenced;
    },
  };

  activePublisher = publisher;
  return publisher;
}

let activePublisher: OperationsEventPublisher | null = null;

export function getOperationsPublisher(): OperationsEventPublisher | null {
  return activePublisher;
}

export function setOperationsPublisher(publisher: OperationsEventPublisher | null): void {
  activePublisher = publisher;
}
