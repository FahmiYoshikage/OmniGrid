import { createBackup } from "@/lib/backup/backup";
import type { JobHandler, JobHandlerRegistry } from "./types";

export function createJobHandlerRegistry(handlers: Record<string, JobHandler> = {}): JobHandlerRegistry {
  return new Map(Object.entries(handlers));
}

export function registerJobHandler(registry: Map<string, JobHandler>, operation: string, handler: JobHandler): void {
  if (!operation.trim()) throw new Error("operation is required");
  registry.set(operation, handler);
}

export function getDefaultJobHandlers(): JobHandlerRegistry {
  const map = new Map<string, JobHandler>();

  registerJobHandler(map, "backup.database", async (payload, context) => {
    context.emit("progress", { stage: "initiating_backup" });
    const maxRetentionCount =
      typeof payload === "object" && payload !== null && "maxRetentionCount" in payload
        ? Number(payload.maxRetentionCount)
        : 10;
    const result = await createBackup({ maxRetentionCount });
    context.emit("progress", { stage: "completed", file: result.backupFile });
    return result;
  });

  registerJobHandler(map, "system.ping", async (payload) => {
    return { ok: true, timestamp: Date.now(), received: payload };
  });

  return map;
}
