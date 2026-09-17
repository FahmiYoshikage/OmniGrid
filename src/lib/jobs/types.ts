export type JobStatus =
  | "pending"
  | "queued"
  | "leased"
  | "running"
  | "succeeded"
  | "failed"
  | "cancel_requested"
  | "cancelled";

export interface OperationJob {
  id: string;
  workspaceId: string;
  operation: string;
  payload: unknown;
  status: JobStatus;
  attempt: number;
  availableAt: number;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  leaseOwner: string | null;
  leaseExpiresAt: number | null;
  cancelRequestedAt: number | null;
  result: unknown;
  error: string | null;
}

export interface OperationEvent {
  id: number;
  jobId: string;
  workspaceId: string;
  sequence: number;
  type: string;
  data: unknown;
  createdAt: number;
}

export interface CreateJobInput {
  operation: string;
  payload?: unknown;
  availableAt?: number;
}

export interface JobTransition {
  status: JobStatus;
  result?: unknown;
  error?: string | null;
}

export interface JobHandlerContext {
  job: OperationJob;
  signal: AbortSignal;
  emit(type: string, data?: unknown): void;
}

export type JobHandler = (payload: unknown, context: JobHandlerContext) => unknown | Promise<unknown>;

export type JobHandlerRegistry = ReadonlyMap<string, JobHandler>;
