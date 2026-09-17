import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { nodeHealthRepo } from "@/lib/db/repos/node-health";
import { scanAllWorkspaceNodes } from "@/lib/nodes/scanner";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireApiPermission("nodes.read");
  if (response) return response;

  try {
    const snapshots = nodeHealthRepo.list(user.workspaceId);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch node health" },
      { status: 500 }
    );
  }
}

export async function POST() {
  const { user, response } = await requireApiPermission("nodes.read");
  if (response) return response;

  try {
    const snapshots = await scanAllWorkspaceNodes(user.workspaceId, user.username);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to probe nodes" },
      { status: 500 }
    );
  }
}
