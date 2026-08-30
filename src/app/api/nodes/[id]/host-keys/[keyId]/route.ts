import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/api";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { sshHostKeysRepo } from "@/lib/db/repos/ssh-host-keys";
import { auditRepo } from "@/lib/db/repos/audit";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const ActionSchema = z.object({ action: z.enum(["trust", "replace", "revoke"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; keyId: string }> }) {
  const { user, response } = await requireApiSession();
  if (response || !user) return response;
  if (user.role !== "owner" && user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const securityResponse = protectMutation(req, "node-host-keys", { userId: user.id });
  if (securityResponse) return securityResponse;
  const { id, keyId } = await ctx.params;
  if (!nodesRepo.get(id, user.workspaceId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const action = parsed.data.action;
  const key = action === "revoke"
    ? sshHostKeysRepo.revoke(user.workspaceId, id, keyId, user.id)
    : sshHostKeysRepo.trust(user.workspaceId, id, keyId, user.id, action === "replace");
  if (!key) return NextResponse.json({ error: "Host key not found or cannot be trusted" }, { status: 404 });
  auditRepo.log({
    workspaceId: user.workspaceId,
    actor: user.username,
    action: `ssh.host_key.${action}`,
    node_id: id,
    detail: { fingerprint: key.fingerprint },
  });
  return NextResponse.json({ hostKey: key });
}
