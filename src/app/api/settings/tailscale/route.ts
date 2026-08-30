import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { integrationSettingsRepo } from "@/lib/db/repos/integration-settings";
import { clearTailnetCache } from "@/lib/tailscale/client";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const TailscaleSettingsSchema = z.object({
  tailnet: z.string().trim().min(1).max(255),
  apiKey: z.string().trim().optional(),
  clearApiKey: z.boolean().optional(),
});

export async function GET() {
  const { user, response } = await requireApiPermission("workspace.read");
  if (response) return response;
  return NextResponse.json({ settings: integrationSettingsRepo.getTailscalePublic(user.workspaceId) });
}

export async function PUT(req: Request) {
  const { user, response } = await requireApiPermission("integrations.manage");
  if (response) return response;
  const securityResponse = protectMutation(req, "settings-tailscale", { userId: user.id });
  if (securityResponse) return securityResponse;
  const body = await req.json().catch(() => null);
  const parsed = TailscaleSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }
  const settings = integrationSettingsRepo.updateTailscale(user.workspaceId, parsed.data);
  clearTailnetCache(user.workspaceId);
  return NextResponse.json({ settings });
}
