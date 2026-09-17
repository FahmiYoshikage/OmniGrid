import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { executeContainerAction, type ContainerAction } from "@/lib/docker/operations";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const ActionSchema = z.object({
  nodeId: z.string().min(1).max(256),
  action: z.enum(["start", "stop", "restart"]),
}).strict();

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { user, response } = await requireApiPermission("containers.manage");
  if (response) return response;

  const securityResponse = protectMutation(request, "container-action", { userId: user.id, limit: 30 });
  if (securityResponse) return securityResponse;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = ActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action payload", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await executeContainerAction({
    workspaceId: user.workspaceId,
    nodeId: parsed.data.nodeId,
    containerId: id,
    action: parsed.data.action as ContainerAction,
    actor: user.username,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Action failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result });
}
