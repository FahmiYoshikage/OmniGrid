import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";

export interface BackupManifest {
  version: string;
  schemaVersion: number;
  timestamp: string;
  createdAt: number;
  checksumSha256: string;
  fileSizeBytes: number;
  dbFileName: string;
  stats: {
    workspaces: number;
    users: number;
    nodes: number;
    monitors: number;
    runbooks: number;
  };
}

export interface BackupResult {
  ok: boolean;
  backupFile: string;
  manifestFile: string;
  manifest: BackupManifest;
  durationMs: number;
  error?: string;
}

export interface BackupItem {
  name: string;
  backupPath: string;
  manifestPath?: string;
  manifest?: BackupManifest;
  sizeBytes: number;
  createdAt: number;
}

function getSafeCount(db: Database.Database, tableName: string): number {
  try {
    const row = db.prepare(`SELECT COUNT(*) as c FROM "${tableName}"`).get() as { c: number } | undefined;
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

function computeFileHash(filePath: string): string {
  const fileBuffer = readFileSync(filePath);
  return createHash("sha256").update(fileBuffer).digest("hex");
}

export async function createBackup(options: {
  outputDir?: string;
  maxRetentionCount?: number;
} = {}): Promise<BackupResult> {
  const startTime = Date.now();
  const env = getEnv();
  const baseDir = options.outputDir
    ? resolve(options.outputDir)
    : resolve(dirname(env.OMNIGRID_DB_PATH), "backups");

  mkdirSync(baseDir, { recursive: true });

  const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `omnigrid-backup-${dateStr}.db`;
  const backupFilePath = join(baseDir, backupFileName);
  const manifestFilePath = join(baseDir, `omnigrid-backup-${dateStr}.manifest.json`);

  const liveDb = getDb();

  // 1. Hot online backup using better-sqlite3 native backup API
  await liveDb.backup(backupFilePath);

  // 2. Validate backup integrity with PRAGMA integrity_check
  const backupDb = new Database(backupFilePath, { readonly: true });
  try {
    const integrity = backupDb.pragma("integrity_check") as Array<{ integrity_check: string }>;
    if (!integrity || integrity[0]?.integrity_check !== "ok") {
      throw new Error(`Backup database integrity check failed: ${JSON.stringify(integrity)}`);
    }

    // Read metadata from the backup database
    let schemaVersion = 0;
    try {
      const schemaRow = backupDb.prepare("SELECT MAX(version) as v FROM schema_version").get() as { v?: number } | undefined;
      schemaVersion = schemaRow?.v ?? 0;
    } catch {
      schemaVersion = 0;
    }

    const stats = {
      workspaces: getSafeCount(backupDb, "workspaces"),
      users: getSafeCount(backupDb, "users"),
      nodes: getSafeCount(backupDb, "nodes"),
      monitors: getSafeCount(backupDb, "uptime_monitors"),
      runbooks: getSafeCount(backupDb, "runbooks"),
    };

    const checksumSha256 = computeFileHash(backupFilePath);
    const fileSizeBytes = statSync(backupFilePath).size;

    const manifest: BackupManifest = {
      version: "1.0",
      schemaVersion,
      timestamp: new Date().toISOString(),
      createdAt: Date.now(),
      checksumSha256,
      fileSizeBytes,
      dbFileName: backupFileName,
      stats,
    };

    writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2), "utf8");

    // 3. Clean up older backups according to retention count
    pruneOldBackups(baseDir, options.maxRetentionCount ?? 10);

    return {
      ok: true,
      backupFile: backupFilePath,
      manifestFile: manifestFilePath,
      manifest,
      durationMs: Date.now() - startTime,
    };
  } finally {
    backupDb.close();
  }
}

export function listBackups(outputDir?: string): BackupItem[] {
  const env = getEnv();
  const baseDir = outputDir
    ? resolve(outputDir)
    : resolve(dirname(env.OMNIGRID_DB_PATH), "backups");

  if (!existsSync(baseDir)) return [];

  const files = readdirSync(baseDir);
  const dbFiles = files.filter((f) => f.endsWith(".db") && f.startsWith("omnigrid-backup-"));

  return dbFiles
    .map((fileName) => {
      const dbPath = join(baseDir, fileName);
      const manifestName = fileName.replace(/\.db$/, ".manifest.json");
      const manifestPath = join(baseDir, manifestName);
      let manifest: BackupManifest | undefined;
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        } catch {}
      }
      const stat = statSync(dbPath);
      return {
        name: fileName,
        backupPath: dbPath,
        manifestPath: existsSync(manifestPath) ? manifestPath : undefined,
        manifest,
        sizeBytes: stat.size,
        createdAt: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function pruneOldBackups(baseDir: string, maxRetentionCount = 10): void {
  const backups = listBackups(baseDir);
  if (backups.length <= maxRetentionCount) return;

  const toRemove = backups.slice(maxRetentionCount);
  for (const item of toRemove) {
    try {
      unlinkSync(item.backupPath);
      if (item.manifestPath && existsSync(item.manifestPath)) {
        unlinkSync(item.manifestPath);
      }
    } catch {}
  }
}
