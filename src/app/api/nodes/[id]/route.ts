import { NextResponse } from "next/server";
import { z } from "zod";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { requireApiPermission } from "@/lib/auth/api";
import { MacAddressSchema, WolBroadcastSchema } from "@/lib/wol";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const NodeInputSchema = z.object({
  name: z.string().min(1).max(64),
  hostname: z.string().min(1).max(255),
  tailscale_id: z.string().nullish(),
  os: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  ssh_user: z.string().nullish(),
  ssh_port: z.number().int().min(1).max(65535).optional(),
  ssh_mode: z.enum(["tailscale", "key", "password"]).optional(),
  credential_id: z.string().nullish(),
  mac_address: MacAddressSchema,
  wol_broadcast: WolBroadcastSchema,
  notes: z.string().nullish(),
});

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiPermission("nodes.manage");
  if (response) return response;
  const securityResponse = protectMutation(_req, "nodes", { userId: user.id, limit: 30 });
  if (securityResponse) return securityResponse;
  const { id } = await ctx.params;
  const existing = nodesRepo.get(id, user.workspaceId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  nodesRepo.delete(id, user.workspaceId);
  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiPermission("nodes.read");
  if (response) return response;
  const { id } = await ctx.params;
  const node = nodesRepo.get(id, user.workspaceId);
  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ node });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiPermission("nodes.manage");
  if (response) return response;
  const securityResponse = protectMutation(req, "nodes", { userId: user.id });
  if (securityResponse) return securityResponse;
  const { id } = await ctx.params;
  const existing = nodesRepo.get(id, user.workspaceId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = NodeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const node = nodesRepo.update(id, parsed.data, user.workspaceId);
    return NextResponse.json({ node });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
