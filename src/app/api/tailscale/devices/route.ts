import { NextResponse } from "next/server";
import { getTailnet } from "@/lib/tailscale/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  try {
    const snapshot = await getTailnet({ force });
    return NextResponse.json(snapshot);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
