/**
 * OmniGrid CLI Backup Utility.
 * Usage:
 *   npm run backup
 *   node --env-file=.env.local --import tsx scripts/backup.ts
 */

import { createBackup, listBackups } from "@/lib/backup/backup";

async function run() {
  console.log("🛡️  Starting OmniGrid online database backup...");
  try {
    const result = await createBackup();
    console.log(`✅ Backup successfully created in ${result.durationMs}ms`);
    console.log(`   Database: ${result.backupFile} (${(result.manifest.fileSizeBytes / 1024).toFixed(1)} KB)`);
    console.log(`   Manifest: ${result.manifestFile}`);
    console.log(`   Schema v${result.manifest.schemaVersion}, SHA256: ${result.manifest.checksumSha256.slice(0, 16)}...`);
    console.log(`   Stats: ${result.manifest.stats.nodes} nodes, ${result.manifest.stats.workspaces} workspaces, ${result.manifest.stats.monitors} monitors`);

    const all = listBackups();
    console.log(`   Total snapshots retained: ${all.length}`);
  } catch (error) {
    console.error("❌ Backup failed:", error);
    process.exit(1);
  }
}

run();
