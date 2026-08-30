import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { integrationSettingsRepo } from "@/lib/db/repos/integration-settings";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const CloudflareSettingsSchema = z.object({
  accountId: z.string().trim().min(1).max(255),
  tunnelToken: z.string().trim().optional(),
  apiToken: z.string().trim().optional(),
  clearTunnelToken: z.boolean().optional(),
  clearApiToken: z.boolean().optional(),
});

export async function GET() {
  const { user, response } = await requireApiPermission("workspace.read");
  if (response) return response;
  return NextResponse.json({ settings: integrationSettingsRepo.getCloudflarePublic(user.workspaceId) });
}

export async function PUT(req: Request) {
  const { user, response } = await requireApiPermission("integrations.manage");
  if (response) return response;
  const securityResponse = protectMutation(req, "settings-cloudflare", { userId: user.id });
  if (securityResponse) return securityResponse;
  const body = await req.json().catch(() => null);
  const parsed = CloudflareSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }
  const settings = integrationSettingsRepo.updateCloudflare(user.workspaceId, parsed.data);
  return NextResponse.json({ settings });
}
