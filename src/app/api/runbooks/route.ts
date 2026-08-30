import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { auditRepo } from "@/lib/db/repos/audit";
import { runbooksRepo } from "@/lib/db/repos/runbooks";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const RunbookInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  body: z.string().min(1).max(20000),
  shell: z.string().trim().min(1).max(40).optional(),
});

export async function GET() {
  const { user, response } = await requireApiPermission("runbooks.read");
  if (response) return response;
  return NextResponse.json({ runbooks: runbooksRepo.list(user.workspaceId) });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiPermission("runbooks.manage");
  if (response) return response;
  const securityResponse = protectMutation(request, "runbooks", { userId: user.id });
  if (securityResponse) return securityResponse;

  const body = await request.json().catch(() => null);
  const parsed = RunbookInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const runbook = runbooksRepo.create(parsed.data, user.workspaceId);
  auditRepo.log({
    workspaceId: user.workspaceId,
    actor: user.username,
    action: "runbook.create",
    detail: { runbookId: runbook.id, name: runbook.name },
  });

  return NextResponse.json({ runbook }, { status: 201 });
}
