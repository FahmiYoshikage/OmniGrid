import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { auditRepo } from "@/lib/db/repos/audit";
import { createBackup, listBackups } from "@/lib/backup/backup";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

export async function GET() {
  const { response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const backups = listBackups();
  return NextResponse.json({
    ok: true,
    total: backups.length,
    backups: backups.map((b) => ({
      name: b.name,
      sizeBytes: b.sizeBytes,
      createdAt: b.createdAt,
      stats: b.manifest?.stats,
      schemaVersion: b.manifest?.schemaVersion,
      checksumSha256: b.manifest?.checksumSha256,
    })),
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const securityResponse = protectMutation(request, "backup-create", { userId: user.id, limit: 5 });
  if (securityResponse) return securityResponse;

  try {
    const result = await createBackup();
    auditRepo.log({
      workspaceId: user.workspaceId,
      actor: user.username,
      action: "backup.created",
      detail: {
        file: result.manifest.dbFileName,
        sizeBytes: result.manifest.fileSizeBytes,
        durationMs: result.durationMs,
        stats: result.manifest.stats,
      },
    });

    return NextResponse.json({
      ok: true,
      backup: {
        file: result.manifest.dbFileName,
        sizeBytes: result.manifest.fileSizeBytes,
        durationMs: result.durationMs,
        stats: result.manifest.stats,
        checksumSha256: result.manifest.checksumSha256,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
