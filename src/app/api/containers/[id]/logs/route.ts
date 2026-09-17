import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { getContainerLogs } from "@/lib/docker/operations";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { user, response } = await requireApiPermission("containers.manage");
  if (response) return response;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get("nodeId");

  if (!nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  const tail = Math.min(Number(searchParams.get("tail")) || 150, 1000);

  try {
    const result = await getContainerLogs({
      workspaceId: user.workspaceId,
      nodeId,
      containerId: id,
      actor: user.username,
      tail,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve logs" },
      { status: 500 }
    );
  }
}
