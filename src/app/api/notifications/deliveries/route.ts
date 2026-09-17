import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { notificationsRepo } from "@/lib/db/repos/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { user, response } = await requireApiPermission("workspace.manage");
  if (response) return response;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);

  const deliveries = notificationsRepo.listDeliveries(user.workspaceId, limit);
  return NextResponse.json({ deliveries });
}
