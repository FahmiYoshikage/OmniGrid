import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { auditRepo } from "@/lib/db/repos/audit";
import { getDb } from "@/lib/db/client";
import { sha256Hex } from "@/lib/crypto";
import { setActiveWorkspaceId } from "@/lib/auth/session";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { user, response } = await requireApiSession();
  if (response) return response;
  const { token } = await context.params;
  const invitation = getDb().prepare(
    `SELECT id, workspace_id, email, role FROM workspace_invitations
     WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > ?`,
  ).get(sha256Hex(token), Date.now()) as { id: string; workspace_id: string; email: string; role: "admin" | "operator" | "viewer" } | undefined;
  if (!invitation || !user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) return NextResponse.json({ error: "Invitation is invalid or does not match your account" }, { status: 403 });
  const now = Date.now();
  const db = getDb();
  const accept = db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(invitation.workspace_id, user.id, invitation.role, now, now);
    db.prepare("UPDATE workspace_invitations SET accepted_at = ? WHERE id = ?").run(now, invitation.id);
  });
  accept();
  await setActiveWorkspaceId(invitation.workspace_id);
  auditRepo.log({ workspaceId: invitation.workspace_id, actor: user.username, action: "workspace.invitation_accept", detail: { invitationId: invitation.id, role: invitation.role } });
  return NextResponse.json({ ok: true, workspaceId: invitation.workspace_id });
}
