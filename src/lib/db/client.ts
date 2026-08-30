import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getEnv } from "@/lib/env";

/**
 * Single shared SQLite handle for the whole process.
 *
 * Performance tuning rationale:
 *   - WAL: concurrent reads while a writer is active; massively faster commits.
 *   - synchronous=NORMAL: WAL-safe and ~2x faster than FULL on writes.
 *   - cache_size=-64000: 64 MiB of page cache (negative = KiB).
 *   - mmap_size=256MiB: lets SQLite read pages via mmap, skipping syscalls.
 *   - temp_store=MEMORY: keep transient B-trees in RAM.
 *   - foreign_keys=ON: SQLite default is OFF; we want them.
 *   - busy_timeout=5000: tolerate brief lock contention with the WAL writer.
 */

declare global {
  var __omnigridDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  const env = getEnv();
  const dbPath = resolve(env.OMNIGRID_DB_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -64000");
  db.pragma("mmap_size = 268435456");
  db.pragma("temp_store = MEMORY");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function getDb(): Database.Database {
  // Guard against Next.js hot-reload creating multiple handles in dev.
  if (!globalThis.__omnigridDb) {
    globalThis.__omnigridDb = createDb();
  }
  return globalThis.__omnigridDb;
}

/**
 * Tiny prepared-statement cache. Re-preparing the same SQL is wasteful; the
 * underlying better-sqlite3 statement objects are safe to reuse.
 */
const stmtCache = new Map<string, Database.Statement>();
export function prep<T extends unknown[] = unknown[]>(sql: string): Database.Statement<T> {
  let s = stmtCache.get(sql);
  if (!s) {
    s = getDb().prepare(sql);
    stmtCache.set(sql, s);
  }
  return s as Database.Statement<T>;
}
