import { NextResponse } from "next/server";
import { z } from "zod";
import { uptimeRepo } from "@/lib/db/repos/uptime";
import { requireApiPermission } from "@/lib/auth/api";
import { runManualCheck } from "@/lib/uptime/checker";
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/uptime/monitors/[id] — get single monitor with full stats */
export async function GET(_req: Request, { params }: RouteParams) {
  const { user, response } = await requireApiPermission("uptime.read");
  if (response) return response;

  const { id } = await params;
  const monitor = uptimeRepo.getMonitor(id, user.workspaceId);
  if (!monitor) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  const stats = uptimeRepo.getMonitorStats(id);
  const history = uptimeRepo.recentChecks(id, 200);

  return NextResponse.json({ stats, history });
}

/** PUT /api/uptime/monitors/[id] — update a monitor */
export async function PUT(req: Request, { params }: RouteParams) {
  const { user, response } = await requireApiPermission("uptime.manage");
  if (response) return response;
  const securityResponse = protectMutation(req, "uptime-monitors", { userId: user.id });
  if (securityResponse) return securityResponse;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = MonitorInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try { await validateMonitorTarget(parsed.data.kind, parsed.data.target); }
  catch { return NextResponse.json({ error: "Invalid or unsafe monitor target" }, { status: 400 }); }

  const updated = uptimeRepo.updateMonitor(id, parsed.data, user.workspaceId);
  if (!updated) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  return NextResponse.json({ monitor: updated });
}

/** DELETE /api/uptime/monitors/[id] — delete a monitor */
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { user, response } = await requireApiPermission("uptime.manage");
  if (response) return response;
  const securityResponse = protectMutation(_req, "uptime-monitors", { userId: user.id, limit: 20 });
  if (securityResponse) return securityResponse;

  const { id } = await params;
  uptimeRepo.deleteMonitor(id, user.workspaceId);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/uptime/monitors/[id] — toggle enable/disable or trigger manual check */
export async function PATCH(req: Request, { params }: RouteParams) {
  const { user, response } = await requireApiPermission("uptime.manage");
  if (response) return response;
  const securityResponse = protectMutation(req, "uptime-monitors", { userId: user.id, limit: 20 });
  if (securityResponse) return securityResponse;

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (body?.action === "check_now") {
    const monitor = uptimeRepo.getMonitor(id, user.workspaceId);
    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }
    const result = await runManualCheck(id, user.workspaceId);
    return NextResponse.json({ result });
  }

  if (typeof body?.enabled === "boolean") {
    uptimeRepo.toggleMonitor(id, body.enabled, user.workspaceId);
    const monitor = uptimeRepo.getMonitor(id, user.workspaceId);
    return NextResponse.json({ monitor });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
