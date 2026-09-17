import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { hasPermission } from "@/lib/auth/permissions";
import { auditRepo } from "@/lib/db/repos/audit";
import { jobsRepo } from "@/lib/jobs/repository";
import { cancelRunbook } from "@/lib/ssh/manager";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { user, response } = await requireApiPermission("runbooks.read");
  if (response) return response;
  const job = jobsRepo.get((await context.params).id, user.workspaceId);
  return job ? NextResponse.json({ job }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(request: Request, context: Context) {
  const { user, response } = await requireApiPermission("runbooks.execute");
  if (response) return response;
  const securityResponse = protectMutation(request, "jobs-cancel", { userId: user.id, limit: 30 });
  if (securityResponse) return securityResponse;
  const id = (await context.params).id;
  const job = jobsRepo.get(id, user.workspaceId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payload = job.payload as { nodeId?: string; runbookId?: string; actor?: string };
  if (payload.runbookId === undefined || (!hasPermission(user, "runbooks.manage") && payload.actor !== user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!cancelRunbook(id, user.workspaceId, "user-cancel")) return NextResponse.json({ error: "Job is no longer running" }, { status: 409 });
  auditRepo.log({ workspaceId: user.workspaceId, actor: user.username, action: "job.cancel", session_id: id, detail: { operation: job.operation } });
  return NextResponse.json({ job: jobsRepo.get(id, user.workspaceId) });
}
