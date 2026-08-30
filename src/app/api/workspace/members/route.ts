import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { auditRepo } from "@/lib/db/repos/audit";
import { workspacesRepo } from "@/lib/db/repos/workspaces";
import { protectMutation } from "@/lib/security/request";

const RoleSchema = z.enum(["admin", "operator", "viewer"]);

export async function GET() {
  const { user, response } = await requireApiPermission("workspace.read");
  if (response) return response;
  return NextResponse.json({ members: workspacesRepo.listMembers(user.workspaceId) });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApiPermission("members.manage");
  if (response) return response;
  const securityResponse = protectMutation(request, "workspace-members", { userId: user.id, limit: 30 });
  if (securityResponse) return securityResponse;
  const parsed = z.object({ userId: z.string().min(1).max(100), role: RoleSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === user.id) return NextResponse.json({ error: "Invalid member update" }, { status: 400 });
  if (!workspacesRepo.setRole(user.workspaceId, parsed.data.userId, parsed.data.role)) return NextResponse.json({ error: "Member not found or cannot be changed" }, { status: 404 });
  auditRepo.log({ workspaceId: user.workspaceId, actor: user.username, action: "workspace.member_role_update", detail: { userId: parsed.data.userId, role: parsed.data.role } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { user, response } = await requireApiPermission("members.manage");
  if (response) return response;
  const securityResponse = protectMutation(request, "workspace-members", { userId: user.id, limit: 30 });
  if (securityResponse) return securityResponse;
  const parsed = z.object({ userId: z.string().min(1).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === user.id || !workspacesRepo.removeMember(user.workspaceId, parsed.data.userId)) return NextResponse.json({ error: "Member not found or cannot be removed" }, { status: 404 });
  auditRepo.log({ workspaceId: user.workspaceId, actor: user.username, action: "workspace.member_remove", detail: { userId: parsed.data.userId } });
  return NextResponse.json({ ok: true });
}
