import { PageHeader } from "@/components/app-shell";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { TerminalWorkspace } from "./terminal-workspace";

export const dynamic = "force-dynamic";

export default async function TerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string }>;
}) {
  const { node } = await searchParams;
  const nodes = nodesRepo.list().map((n) => ({
    id: n.id,
    name: n.name,
    hostname: n.hostname,
    ssh_mode: n.ssh_mode,
  }));
  return (
    <div className="flex h-full min-h-[calc(100vh-1.5rem)] flex-col">
      <PageHeader
        title="Terminal"
        description="Web SSH sessions. Tabs for multiple servers. Sessions auto-close after 30 min of inactivity."
      />
      <div className="min-h-0 flex-1 p-4">
        <TerminalWorkspace nodes={nodes} initialNodeId={node} />
      </div>
    </div>
  );
}
