import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./client";

/**
 * Minimal forward-only migration runner.
 *
 * - schema.sql is treated as version 1 (the baseline).
 * - Future migrations live in src/lib/db/migrations/NNN_name.sql and apply in
 *   numeric order, each in a single transaction.
 * - Idempotent: schema.sql uses CREATE TABLE IF NOT EXISTS, and applied
 *   versions are tracked in schema_version.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

function currentVersion(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT MAX(version) AS v FROM schema_version")
    .get() as { v: number | null } | undefined;
  return row?.v ?? 0;
}

function recordVersion(v: number) {
  getDb()
    .prepare("INSERT OR IGNORE INTO schema_version(version, applied_at) VALUES (?, ?)")
    .run(v, Date.now());
}

export function migrate(): { applied: number[]; current: number } {
  const db = getDb();

  // Baseline (v1) — schema.sql is fully idempotent.
  const schema = readFileSync(join(HERE, "schema.sql"), "utf8");
  db.exec(schema);
  recordVersion(1);

  const applied: number[] = [];
  const migrationsDir = join(HERE, "migrations");
  let entries: string[] = [];
  try {
    entries = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    // no migrations dir yet — fine.
  }

  for (const file of entries) {
    const m = /^(\d+)_/.exec(file);
    if (!m) continue;
    const v = Number(m[1]);
    if (v <= currentVersion()) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      recordVersion(v);
    });
    tx();
    applied.push(v);
  }

  return { applied, current: currentVersion() };
}

// Allow `tsx src/lib/db/migrate.ts` from npm script.
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = migrate();
  // eslint-disable-next-line no-console
  console.log(`[migrate] current version: ${result.current}, newly applied: [${result.applied.join(", ")}]`);
}
