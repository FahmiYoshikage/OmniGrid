import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { runbooksRepo } from "@/lib/db/repos/runbooks";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { user, response } = await requireApiPermission("runbooks.read");
  if (response) return response;

  const url = new URL(request.url);
  const nodeId = url.searchParams.get("nodeId") ?? undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 100);

  const executions = runbooksRepo.listExecutions(user.workspaceId, { nodeId, limit });
  return NextResponse.json({ executions });
}
