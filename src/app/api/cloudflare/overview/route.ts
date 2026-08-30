import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api";
import { getCloudflareOverview } from "@/lib/cloudflare/client";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireApiPermission("workspace.read");
  if (response) return response;

  try {
    const overview = await getCloudflareOverview(user.workspaceId);
    return NextResponse.json({ overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Cloudflare overview";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
