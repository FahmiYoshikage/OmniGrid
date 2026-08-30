import { PageHeader } from "@/components/app-shell";
import { requireSessionUser } from "@/lib/auth/access";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { WolClient } from "./wol-client";

export const dynamic = "force-dynamic";

export default async function WolPage() {
  const user = await requireSessionUser();
  const nodes = nodesRepo.list(user.workspaceId).map((node) => ({
    id: node.id,
    name: node.name,
    hostname: node.hostname,
    mac_address: node.mac_address,
    wol_broadcast: node.wol_broadcast,
  }));

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Wake-on-LAN" description="Send a magic packet from the OmniGrid host to a configured node on your network." />
      <WolClient nodes={nodes} />
    </div>
  );
}
