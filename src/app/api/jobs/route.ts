import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { jobsRepo } from "@/lib/jobs/repository";
import { runRunbook } from "@/lib/ssh/manager";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";
const CreateSchema = z.object({ kind: z.literal("runbook.execute"), nodeId: z.string().uuid(), runbookId: z.string().uuid() }).strict();

export async function GET(request: Request) {
  const { user, response } = await requireApiPermission("runbooks.read");
  if (response) return response;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as import("@/lib/jobs/types").JobStatus | null;
  const jobs = jobsRepo.list(user.workspaceId, { status: status ?? undefined, limit: Number(url.searchParams.get("limit")) || 25, offset: Number(url.searchParams.get("offset")) || 0 });
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiPermission("runbooks.execute");
  if (response) return response;
  const securityResponse = protectMutation(request, "jobs-create", { userId: user.id, limit: 10 });
  if (securityResponse) return securityResponse;
  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  try {
    const job = await runRunbook({ ...parsed.data, workspaceId: user.workspaceId, actor: user.username, handlers: { onOutput() {}, onStatus() {}, onExit() {}, onError() {} } });
    return NextResponse.json({ job: jobsRepo.get(job.id, user.workspaceId) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start job" }, { status: 400 });
  }
}
