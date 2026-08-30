import { NextResponse } from "next/server";
import { getTailnet } from "@/lib/tailscale/client";
import { requireApiPermission } from "@/lib/auth/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { user, response } = await requireApiPermission("workspace.read");
  if (response) return response;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  try {
    const snapshot = await getTailnet({ force, workspaceId: user.workspaceId });
    if (!snapshot) {
      return NextResponse.json({ error: "Tailscale not configured. Add your API key in Settings." }, { status: 404 });
    }
    return NextResponse.json(snapshot);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
