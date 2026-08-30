import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { auditRepo } from "@/lib/db/repos/audit";
import { getDb } from "@/lib/db/client";
import { sha256Hex } from "@/lib/crypto";
import { buildPublicUrl } from "@/lib/auth/urls";
import { protectMutation } from "@/lib/security/request";

const InvitationSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["admin", "operator", "viewer"]),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiPermission("members.manage");
  if (response) return response;
  const securityResponse = protectMutation(request, "workspace-invitations", { userId: user.id, limit: 10 });
  if (securityResponse) return securityResponse;
  const parsed = InvitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });

  const token = randomBytes(32).toString("hex");
  const id = crypto.randomUUID();
  const now = Date.now();
  getDb().prepare(
    `INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, invited_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, user.workspaceId, parsed.data.email.toLowerCase(), parsed.data.role, sha256Hex(token), user.id, now + 7 * 86400000, now);
  auditRepo.log({ workspaceId: user.workspaceId, actor: user.username, action: "workspace.invitation_create", detail: { email: parsed.data.email.toLowerCase(), role: parsed.data.role } });
  return NextResponse.json({ invitationUrl: buildPublicUrl(`/invitations/${token}`, request.url).toString(), expiresAt: now + 7 * 86400000 }, { status: 201 });
}

export async function GET() {
  const { user, response } = await requireApiPermission("members.manage");
  if (response) return response;
  const invitations = getDb().prepare(
    `SELECT id, email, role, expires_at, accepted_at, created_at FROM workspace_invitations
     WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at > ? ORDER BY created_at DESC`,
  ).all(user.workspaceId, Date.now());
  return NextResponse.json({ invitations });
}
