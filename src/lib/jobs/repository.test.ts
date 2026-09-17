import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jobsRepo } from "./repository";

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

describe("operation jobs", () => {
  it("isolates jobs and events by workspace", () => {
    const first = workspace("jobs-first");
    const second = workspace("jobs-second");
    const created = jobsRepo.create({ operation: "deploy", payload: { host: "one" } }, first);

    expect(jobsRepo.list(first)).toHaveLength(1);
    expect(jobsRepo.list(second)).toEqual([]);
    expect(jobsRepo.get(created.id, second)).toBeUndefined();
    expect(jobsRepo.appendEvent(created.id, second, "wrong")).toBeUndefined();
    expect(jobsRepo.appendEvent(created.id, first, "started", { step: 1 })?.sequence).toBe(1);
    expect(jobsRepo.listEvents(created.id, second)).toEqual([]);
  });

  it("leases a pending job once and increments attempts atomically", () => {
    const id = workspace("jobs-lease");
    const created = jobsRepo.create({ operation: "backup", availableAt: 10_000 }, id);
    const leased = jobsRepo.lease(id, "worker-a", 1000, 10_000);

    expect(leased).toMatchObject({ id: created.id, status: "running", attempt: 1, leaseOwner: "worker-a", leaseExpiresAt: 11_000 });
    expect(jobsRepo.lease(id, "worker-b", 1000, 10_000)).toBeUndefined();
  });

  it("recovers expired leases and preserves cancellation intent", () => {
    const id = workspace("jobs-recovery");
    const job = jobsRepo.create({ operation: "sync", availableAt: 1_000 }, id);
    jobsRepo.lease(id, "worker-a", 100, 1000);
    expect(jobsRepo.recoverExpiredLeases(1100)).toBe(1);
    expect(jobsRepo.get(job.id, id)?.status).toBe("pending");
    jobsRepo.lease(id, "worker-a", 100, 2000);
    expect(jobsRepo.requestCancel(job.id, id, 2050)?.status).toBe("cancel_requested");
    expect(jobsRepo.recoverExpiredLeases(2200)).toBe(1);
    expect(jobsRepo.get(job.id, id)?.status).toBe("cancelled");
  });

  it("enforces event ordering and the bounded event payload", () => {
    const id = workspace("jobs-events");
    const job = jobsRepo.create({ operation: "report" }, id);
    jobsRepo.appendEvent(job.id, id, "one", { ok: true }, 1);
    jobsRepo.appendEvent(job.id, id, "two", undefined, 2);
    expect(jobsRepo.listEvents(job.id, id).map((event) => event.sequence)).toEqual([1, 2]);
    expect(() => jobsRepo.appendEvent(job.id, id, "large", "x".repeat(64 * 1024))).toThrow(/65536/);
  });

  it("transitions, then prunes terminal jobs by retention", () => {
    const id = workspace("jobs-retention");
    const job = jobsRepo.create({ operation: "cleanup", availableAt: 10 }, id);
    jobsRepo.lease(id, "worker", 1000, 10);
    expect(jobsRepo.transition(job.id, id, { status: "succeeded", result: { count: 2 } }, "worker", 20)?.result).toEqual({ count: 2 });
    expect(jobsRepo.prune(id, 21)).toBe(1);
    expect(jobsRepo.get(job.id, id)).toBeUndefined();
  });
});
