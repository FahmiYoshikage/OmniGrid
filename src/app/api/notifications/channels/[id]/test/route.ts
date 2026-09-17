import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { notificationsRepo } from "@/lib/db/repos/notifications";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const securityResponse = protectMutation(request, "notification-test", { userId: user.id });
  if (securityResponse) return securityResponse;

  const { id } = await context.params;
  const channel = notificationsRepo.get(id, user.workspaceId);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  const results = await dispatchNotification(user.workspaceId, {
    type: "test.alert",
    title: "OmniGrid Test Notification",
    message: `Test alert dispatched by @${user.username} from OmniGrid Control Plane.`,
    severity: "info",
    details: {
      Channel: channel.name,
      Type: channel.type,
      Status: "Online & Verified",
      Timestamp: new Date().toISOString(),
    },
  });

  const thisResult = results.find((r) => r.channelId === id);
  return NextResponse.json({
    ok: thisResult?.success ?? false,
    result: thisResult,
  });
}
