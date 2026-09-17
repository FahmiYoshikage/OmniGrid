import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createBackup, listBackups } from "./backup";

describe("Database Backup Engine", () => {
  const testBackupDir = join(process.cwd(), "data", "test-backups");

  beforeAll(() => {
    if (existsSync(testBackupDir)) rmSync(testBackupDir, { recursive: true, force: true });
  });

  afterAll(() => {
    if (existsSync(testBackupDir)) rmSync(testBackupDir, { recursive: true, force: true });
  });

  it("creates a verified hot SQLite backup snapshot with manifest", async () => {
    const result = await createBackup({ outputDir: testBackupDir, maxRetentionCount: 5 });
    expect(result.ok).toBe(true);
    expect(existsSync(result.backupFile)).toBe(true);
    expect(existsSync(result.manifestFile)).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.manifest.checksumSha256).toHaveLength(64);
    expect(result.manifest.stats).toBeDefined();

    const backups = listBackups(testBackupDir);
    expect(backups.length).toBeGreaterThanOrEqual(1);
    expect(backups[0].sizeBytes).toBeGreaterThan(0);
    expect(backups[0].manifest).toBeDefined();
  });
});
