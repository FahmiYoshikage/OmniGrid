import { randomUUID } from "node:crypto";
import { jobsRepo } from "./repository";
import type { JobHandlerRegistry, OperationJob } from "./types";

export interface WorkerClock {
  now(): number;
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

export interface JobWorkerOptions {
  workspaceId: string;
  handlers: JobHandlerRegistry;
  workerId?: string;
  concurrency?: number;
  leaseMs?: number;
  pollMs?: number;
  clock?: WorkerClock;
  onEvent?: (event: WorkerEvent) => void;
}

export type WorkerEvent = {
  type: "leased" | "running" | "succeeded" | "failed" | "cancelled" | "recovered";
  job: OperationJob;
  data?: unknown;
};

export interface JobWorker {
  start(): void;
  stop(deadlineMs?: number): Promise<void>;
  drain(): Promise<void>;
  isRunning(): boolean;
}

const realClock: WorkerClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle),
};

export function createJobWorker(options: JobWorkerOptions): JobWorker {
  const clock = options.clock ?? realClock;
  const workerId = options.workerId ?? randomUUID();
  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? 1));
  const leaseMs = Math.max(1, options.leaseMs ?? 30_000);
  const pollMs = Math.max(1, options.pollMs ?? 250);
  const active = new Map<string, AbortController>();
  let started = false;
  let stopping = false;
  let pollHandle: ReturnType<typeof setTimeout> | undefined;
  let waiters: Array<() => void> = [];

  const emit = (type: WorkerEvent["type"], job: OperationJob, data?: unknown) => options.onEvent?.({ type, job, data });
  const wake = () => {
    if (active.size !== 0) return;
    const current = waiters;
    waiters = [];
    current.forEach((resolve) => resolve());
  };
  const drain = () => active.size === 0 ? Promise.resolve() : new Promise<void>((resolve) => waiters.push(resolve));
  const schedule = () => {
    if (started && !stopping && pollHandle === undefined) {
      pollHandle = clock.setTimeout(() => { pollHandle = undefined; void tick(); }, pollMs);
    }
  };
  const run = async (job: OperationJob) => {
    const controller = new AbortController();
    active.set(job.id, controller);
    try {
      const running = jobsRepo.markRunning(job.id, options.workspaceId, workerId, clock.now());
      if (!running) return;
      emit("running", running);
      const handler = options.handlers.get(running.operation);
      if (!handler) throw new Error(`No handler registered for operation: ${running.operation}`);
      const result = await handler(running.payload, {
        job: running,
        signal: controller.signal,
        emit: (type, data) => { jobsRepo.appendEvent(running.id, options.workspaceId, type, data, clock.now()); },
      });
      const current = jobsRepo.get(running.id, options.workspaceId);
      const status = current?.status === "cancel_requested" ? "cancelled" : "succeeded";
      const finished = jobsRepo.transition(running.id, options.workspaceId, { status, result }, workerId, clock.now());
      if (finished) emit(status, finished);
    } catch (error) {
      const current = jobsRepo.get(job.id, options.workspaceId);
      const status = current?.status === "cancel_requested" || controller.signal.aborted ? "cancelled" : "failed";
      const finished = jobsRepo.transition(job.id, options.workspaceId, { status, error: error instanceof Error ? error.message : String(error) }, workerId, clock.now());
      if (finished) emit(status, finished);
    } finally {
      active.delete(job.id);
      wake();
      void tick();
    }
  };
  async function tick() {
    if (!started) return;
    const recovered = jobsRepo.recoverExpiredLeases(clock.now());
    if (recovered) {
      jobsRepo.list(options.workspaceId, { status: "pending", limit: recovered }).forEach((job) => emit("recovered", job));
    }
    while (!stopping && active.size < concurrency) {
      const job = jobsRepo.acquireLease(options.workspaceId, workerId, leaseMs, clock.now());
      if (!job) break;
      emit("leased", job);
      void run(job);
    }
    schedule();
  }
  return {
    start() { if (!started) { started = true; stopping = false; void tick(); } },
    async stop(deadlineMs = 30_000) {
      if (!started) return;
      stopping = true;
      if (pollHandle !== undefined) { clock.clearTimeout(pollHandle); pollHandle = undefined; }
      const pending = drain();
      active.forEach((controller) => controller.abort());
      await Promise.race([pending, new Promise<void>((resolve) => clock.setTimeout(resolve, Math.max(0, deadlineMs))) ]);
      started = false;
    },
    drain,
    isRunning: () => started && !stopping,
  };
}
