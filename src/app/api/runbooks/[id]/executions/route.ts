import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { runbooksRepo } from "@/lib/db/repos/runbooks";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireApiPermission("runbooks.read");
  if (response) return response;

  const { id } = await context.params;
  const runbook = runbooksRepo.get(id, user.workspaceId);
  if (!runbook) {
    return NextResponse.json({ error: "Runbook not found" }, { status: 404 });
  }

  const executions = runbooksRepo.listExecutions(user.workspaceId, { runbookId: id, limit: 50 });
  const revisions = runbooksRepo.listRevisions(id, user.workspaceId);

  return NextResponse.json({ executions, revisions });
}
