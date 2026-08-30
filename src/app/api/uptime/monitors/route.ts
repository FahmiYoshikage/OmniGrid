import { NextResponse } from "next/server";
import { z } from "zod";
import { uptimeRepo } from "@/lib/db/repos/uptime";
import { requireApiPermission } from "@/lib/auth/api";
import { protectMutation } from "@/lib/security/request";
import { validateMonitorTarget } from "@/lib/uptime/validation";

export const runtime = "nodejs";

const MonitorInputSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(["http", "tcp", "ping"]),
  target: z.string().min(1).max(2048),
  interval_sec: z.number().int().min(10).max(3600).optional(),
  timeout_ms: z.number().int().min(1000).max(60000).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
  expected_status: z.number().int().min(100).max(599).nullable().optional(),
  headers_json: z.string().max(512 * 1024).nullable().optional(),
  body: z.string().max(1024 * 1024).nullable().optional(),
  enabled: z.boolean().optional(),
  notify: z.boolean().optional(),
});

/** GET /api/uptime/monitors — list all monitors with stats for the workspace */
export async function GET() {
  const { user, response } = await requireApiPermission("uptime.read");
  if (response) return response;

  const stats = uptimeRepo.getWorkspaceStats(user.workspaceId);
  const summary = uptimeRepo.workspaceSummary(user.workspaceId);

  return NextResponse.json({ monitors: stats, summary });
}

/** POST /api/uptime/monitors — create a new monitor */
export async function POST(req: Request) {
  const { user, response } = await requireApiPermission("uptime.manage");
  if (response) return response;
  const securityResponse = protectMutation(req, "uptime-monitors", { userId: user.id });
  if (securityResponse) return securityResponse;

  const body = await req.json().catch(() => null);
  const parsed = MonitorInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { kind, target } = parsed.data;
  try { await validateMonitorTarget(kind, target); }
  catch { return NextResponse.json({ error: "Invalid or unsafe monitor target" }, { status: 400 }); }

  try {
    const monitor = uptimeRepo.createMonitor(parsed.data, user.workspaceId);
    return NextResponse.json({ monitor }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
