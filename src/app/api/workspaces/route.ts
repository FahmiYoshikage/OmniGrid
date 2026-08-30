import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/api";
import { auditRepo } from "@/lib/db/repos/audit";
import { workspacesRepo } from "@/lib/db/repos/workspaces";
import { setActiveWorkspaceId } from "@/lib/auth/session";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

function serializeWorkspace(workspace: ReturnType<typeof workspacesRepo.listForUser>[number]) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: workspace.role,
  };
}

export async function GET() {
  const { user, response } = await requireApiSession();
  if (response) return response;
  return NextResponse.json({
    activeWorkspaceId: user.workspaceId,
    workspaces: workspacesRepo.listForUser(user.id).map(serializeWorkspace),
  });
}

export async function PUT(request: Request) {
  const { user, response } = await requireApiSession();
  if (response) return response;
  const securityResponse = protectMutation(request, "workspace-switch", { userId: user.id, limit: 30 });
  if (securityResponse) return securityResponse;
  const parsed = z.object({ workspaceId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid workspace" }, { status: 400 });

  const workspace = workspacesRepo.listForUser(user.id).find((item) => item.id === parsed.data.workspaceId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  await setActiveWorkspaceId(workspace.id);
  auditRepo.log({
    workspaceId: workspace.id,
    actor: user.username,
    action: "workspace.switch",
    detail: { fromWorkspaceId: user.workspaceId },
  });
  return NextResponse.json({ activeWorkspace: serializeWorkspace(workspace) });
}
