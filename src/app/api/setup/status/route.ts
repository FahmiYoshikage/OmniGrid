import { NextResponse } from "next/server";
import { isSetupNeeded, getPreflightChecks } from "@/lib/setup/status";

export const runtime = "nodejs";

export async function GET() {
  const needed = isSetupNeeded();
  const preflight = getPreflightChecks();

  return NextResponse.json({
    setupNeeded: needed,
    preflight,
  });
}
