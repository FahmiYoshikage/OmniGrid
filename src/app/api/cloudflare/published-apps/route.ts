import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { createCloudflarePublishedHostname } from "@/lib/cloudflare/client";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const CreatePublishedAppSchema = z.object({
  tunnelId: z.string().trim().min(1),
  hostname: z.string().trim().min(3),
  service: z.string().trim().min(1),
  path: z.string().trim().optional(),
});

export async function POST(req: Request) {
  const { user, response } = await requireApiPermission("cloudflare.manage");
  if (response) return response;
  const securityResponse = protectMutation(req, "cloudflare-published-apps", { userId: user.id });
  if (securityResponse) return securityResponse;

  const body = await req.json().catch(() => null);
  const parsed = CreatePublishedAppSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await createCloudflarePublishedHostname(user.workspaceId, parsed.data);
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create published hostname";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
