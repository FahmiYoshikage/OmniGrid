import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/api";
import { auditRepo } from "@/lib/db/repos/audit";
import { runbooksRepo } from "@/lib/db/repos/runbooks";

export const runtime = "nodejs";

const RunbookInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  body: z.string().min(1).max(20000),
  shell: z.string().trim().min(1).max(40).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireApiSession();
  if (response) return response;
  const { id } = await context.params;
  const runbook = runbooksRepo.get(id, user.workspaceId);
  if (!runbook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ runbook });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireApiSession();
  if (response) return response;
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = RunbookInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const runbook = runbooksRepo.update(id, parsed.data, user.workspaceId);
  if (!runbook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  auditRepo.log({
    workspaceId: user.workspaceId,
    actor: user.username,
    action: "runbook.update",
    detail: { runbookId: runbook.id, name: runbook.name },
  });

  return NextResponse.json({ runbook });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireApiSession();
  if (response) return response;
  const { id } = await context.params;
  const runbook = runbooksRepo.get(id, user.workspaceId);
  if (!runbook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  runbooksRepo.delete(id, user.workspaceId);
  auditRepo.log({
    workspaceId: user.workspaceId,
    actor: user.username,
    action: "runbook.delete",
    detail: { runbookId: id, name: runbook.name },
  });

  return NextResponse.json({ ok: true });
}
