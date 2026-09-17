import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { notificationsRepo } from "@/lib/db/repos/notifications";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const UpdateChannelSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  type: z.enum(["telegram", "discord", "email", "webhook"]).optional(),
  enabled: z.boolean().optional(),
  events: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { user, response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const { id } = await context.params;
  const channel = notificationsRepo.get(id, user.workspaceId);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  return NextResponse.json({ channel });
}

export async function PUT(request: Request, context: Context) {
  const { user, response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const securityResponse = protectMutation(request, "notifications-channel", { userId: user.id });
  if (securityResponse) return securityResponse;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const updated = notificationsRepo.update(id, parsed.data, user.workspaceId);
  if (!updated) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  return NextResponse.json({ channel: updated });
}

export async function DELETE(request: Request, context: Context) {
  const { user, response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const securityResponse = protectMutation(request, "notifications-channel", { userId: user.id });
  if (securityResponse) return securityResponse;

  const { id } = await context.params;
  const deleted = notificationsRepo.delete(id, user.workspaceId);
  if (!deleted) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
