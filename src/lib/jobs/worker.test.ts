import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jobsRepo } from "./repository";
import { createJobWorker, type WorkerEvent } from "./worker";
import { createJobHandlerRegistry } from "./handlers";

function workspace(label: string) {
  const db = getDb();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO users (id, github_id, username, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, Math.floor(Math.random() * 1_000_000_000), label, now, now);
  db.prepare("INSERT INTO workspaces (id, owner_id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(workspaceId, userId, label, `${label}-${workspaceId}`, now, now);
  return workspaceId;
}

beforeAll(() => {
  migrate();
  const db = getDb();
  db.exec("DROP TABLE IF EXISTS operation_events; DROP TABLE IF EXISTS operation_jobs;");
  db.exec(readFileSync(join(process.cwd(), "src/lib/db/migrations/011_operation_jobs.sql"), "utf8"));
});

afterAll(() => {
  const db = getDb();
  db.prepare("DELETE FROM users").run();
});

describe("job worker", () => {
  it("processes a job with registered handler and records result", async () => {
    const wsId = workspace("worker-success");
    const events: WorkerEvent[] = [];

    const handlers = createJobHandlerRegistry({
      "test.calc": (payload, ctx) => {
        const { a, b } = payload as { a: number; b: number };
        ctx.emit("calc.progress", { step: 1 });
        return { sum: a + b };
      },
    });

    const worker = createJobWorker({
      workspaceId: wsId,
      handlers,
      pollMs: 50,
      onEvent: (event) => events.push(event),
    });

    const job = jobsRepo.create({ operation: "test.calc", payload: { a: 10, b: 32 } }, wsId);
    expect(job.status).toBe("pending");

    worker.start();
    await worker.drain();
    await worker.stop(500);

    const finished = jobsRepo.get(job.id, wsId);
    expect(finished?.status).toBe("succeeded");
    expect(finished?.result).toEqual({ sum: 42 });

    const jobEvents = jobsRepo.listEvents(job.id, wsId);
    expect(jobEvents).toHaveLength(1);
    expect(jobEvents[0]?.type).toBe("calc.progress");
    expect(jobEvents[0]?.data).toEqual({ step: 1 });

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("leased");
    expect(eventTypes).toContain("running");
    expect(eventTypes).toContain("succeeded");
  });

  it("handles handler failure and transitions job to failed", async () => {
    const wsId = workspace("worker-failure");

    const handlers = createJobHandlerRegistry({
      "test.fail": () => {
        throw new Error("Simulated job failure");
      },
    });

    const worker = createJobWorker({
      workspaceId: wsId,
      handlers,
      pollMs: 50,
    });

    const job = jobsRepo.create({ operation: "test.fail" }, wsId);
    worker.start();
    await worker.drain();
    await worker.stop(500);

    const finished = jobsRepo.get(job.id, wsId);
    expect(finished?.status).toBe("failed");
    expect(finished?.error).toBe("Simulated job failure");
  });
});
