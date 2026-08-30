import { NextResponse } from "next/server";
import wol from "wake_on_lan";
import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/api";
import { auditRepo } from "@/lib/db/repos/audit";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { MacAddressSchema, WolBroadcastSchema } from "@/lib/wol";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const WakeInputSchema = z.object({ node_id: z.string().min(1).max(100) });

function sendMagicPacket(macAddress: string, broadcast: string) {
  return new Promise<void>((resolve, reject) => {
    wol.wake(macAddress, { address: broadcast, port: 9, num_packets: 3 }, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiPermission("wol.send");
  if (response) return response;
  const securityResponse = protectMutation(request, "wol", { userId: user.id, limit: 10 });
  if (securityResponse) return securityResponse;

  const parsed = WakeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    auditRepo.log({
      workspaceId: user.workspaceId,
      actor: user.username,
      action: "wol.failed",
      detail: { error: "Invalid request" },
    });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const node = nodesRepo.get(parsed.data.node_id, user.workspaceId);
  if (!node) {
    auditRepo.log({
      workspaceId: user.workspaceId,
      actor: user.username,
      action: "wol.failed",
      detail: { error: "Node not found" },
    });
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const mac = MacAddressSchema.safeParse(node.mac_address);
  const broadcast = WolBroadcastSchema.safeParse(node.wol_broadcast);
  if (!mac.success || !mac.data || !broadcast.success || !broadcast.data) {
    auditRepo.log({
      workspaceId: user.workspaceId,
      actor: user.username,
      action: "wol.failed",
      node_id: node.id,
      detail: { node: node.name, error: "Missing or invalid Wake-on-LAN configuration" },
    });
    return NextResponse.json(
      { error: "This node needs a valid MAC and broadcast address" },
      { status: 400 },
    );
  }

  try {
    await sendMagicPacket(mac.data, broadcast.data);
    auditRepo.log({
      workspaceId: user.workspaceId,
      actor: user.username,
      action: "wol.sent",
      node_id: node.id,
      detail: { node: node.name, mac_address: mac.data, broadcast: broadcast.data },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send magic packet";
    auditRepo.log({
      workspaceId: user.workspaceId,
      actor: user.username,
      action: "wol.failed",
      node_id: node.id,
      detail: { node: node.name, broadcast: broadcast.data, error: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
