import type { JobHandler, JobHandlerRegistry } from "./types";

export function createJobHandlerRegistry(handlers: Record<string, JobHandler> = {}): JobHandlerRegistry {
  return new Map(Object.entries(handlers));
}

export function registerJobHandler(registry: Map<string, JobHandler>, operation: string, handler: JobHandler): void {
  if (!operation.trim()) throw new Error("operation is required");
  registry.set(operation, handler);
}
