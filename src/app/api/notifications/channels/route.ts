import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { notificationsRepo } from "@/lib/db/repos/notifications";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const CreateChannelSchema = z.object({
  name: z.string().trim().min(1).max(64),
  type: z.enum(["telegram", "discord", "email", "webhook"]),
  enabled: z.boolean().optional().default(true),
  events: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()),
});

export async function GET() {
  const { user, response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const channels = notificationsRepo.list(user.workspaceId);
  return NextResponse.json({ channels });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const securityResponse = protectMutation(request, "notifications-channel", { userId: user.id });
  if (securityResponse) return securityResponse;

  const body = await request.json().catch(() => null);
  const parsed = CreateChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const channel = notificationsRepo.create(parsed.data, user.workspaceId);
    return NextResponse.json({ channel }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create channel" },
      { status: 400 }
    );
  }
}
