import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { sshHostKeysRepo } from "@/lib/db/repos/ssh-host-keys";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiSession();
  if (response || !user) return response;
  if (user.role !== "owner" && user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  if (!nodesRepo.get(id, user.workspaceId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ hostKeys: sshHostKeysRepo.list(user.workspaceId, id) });
}
