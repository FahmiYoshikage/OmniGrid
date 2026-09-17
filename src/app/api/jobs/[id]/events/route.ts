import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { jobsRepo } from "@/lib/jobs/repository";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiPermission("runbooks.read");
  if (response) return response;
  const id = (await context.params).id;
  const url = new URL(request.url);
  const job = jobsRepo.get(id, user.workspaceId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const after = Math.max(Number(url.searchParams.get("since") ?? url.searchParams.get("after")) || 0, 0);
  const events = jobsRepo.listEvents(id, user.workspaceId, Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 1000))
    .filter((event) => event.sequence > after);
  return NextResponse.json({ events, after });
}
