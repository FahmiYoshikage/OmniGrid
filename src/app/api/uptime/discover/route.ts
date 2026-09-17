import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { getOrDiscoverContainers } from "@/lib/nodes/scanner";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, response } = await requireApiPermission("containers.manage");
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  try {
    const containers = await getOrDiscoverContainers(
      user.workspaceId,
      user.username,
      forceRefresh
    );
    return NextResponse.json({ containers });
  } catch (err) {
    console.error("[uptime] container discovery failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to discover containers" },
      { status: 500 }
    );
  }
}
