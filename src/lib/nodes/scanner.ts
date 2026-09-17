import { exec } from "node:child_process";
import { promisify } from "node:util";
import { nodesRepo, type NodeRow } from "@/lib/db/repos/nodes";
import { nodeHealthRepo, type DiscoveredContainer, type NodeSnapshotRecord } from "@/lib/db/repos/node-health";
import { execSsh } from "@/lib/ssh/exec";

const execAsync = promisify(exec);

const DOCKER_PS_COMMAND = `docker ps --filter network=omnigrid-net --format '{{json .}}'`;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function parseDockerOutput(stdout: string, sourceName: string, nodeId?: string): DiscoveredContainer[] {
  const lines = stdout.trim().split("\n").filter(Boolean);
  const result: DiscoveredContainer[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      result.push({
        id: String(parsed.ID ?? ""),
        name: String(parsed.Names ?? ""),
        image: String(parsed.Image ?? ""),
        state: String(parsed.State ?? ""),
        status: String(parsed.Status ?? ""),
        ports: parsed.Ports ? String(parsed.Ports) : undefined,
        source: sourceName,
        nodeId,
      });
    } catch {
      // ignore non-json line
    }
  }
  return result;
}

export async function scanLocalNode(workspaceId: string): Promise<NodeSnapshotRecord> {
  const start = Date.now();
  try {
    const { stdout } = await execAsync(DOCKER_PS_COMMAND, { timeout: 4000 });
    const latencyMs = Date.now() - start;
    const containers = parseDockerOutput(stdout, "Local Server", "__local__");

    return nodeHealthRepo.upsert({
      workspaceId,
      nodeId: "__local__",
      sourceName: "Local Server",
      containers,
      isReachable: true,
      dockerReachable: true,
      latencyMs,
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Even if docker ps fails locally, local host is reachable
    return nodeHealthRepo.upsert({
      workspaceId,
      nodeId: "__local__",
      sourceName: "Local Server",
      containers: [],
      isReachable: true,
      dockerReachable: false,
      latencyMs,
      errorMessage,
    });
  }
}

export async function scanRemoteNode(
  workspaceId: string,
  node: NodeRow,
  actor: string
): Promise<NodeSnapshotRecord> {
  const start = Date.now();
  try {
    const { stdout } = await execSsh({
      node,
      command: DOCKER_PS_COMMAND,
      workspaceId,
      actor,
      timeoutMs: 5000,
    });
    const latencyMs = Date.now() - start;
    const containers = parseDockerOutput(stdout, node.name, node.id);

    return nodeHealthRepo.upsert({
      workspaceId,
      nodeId: node.id,
      sourceName: node.name,
      containers,
      isReachable: true,
      dockerReachable: true,
      latencyMs,
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isSshFailed = errorMessage.includes("SSH_") || errorMessage.includes("ETIMEDOUT") || errorMessage.includes("ECONNREFUSED");

    return nodeHealthRepo.upsert({
      workspaceId,
      nodeId: node.id,
      sourceName: node.name,
      containers: [],
      isReachable: !isSshFailed,
      dockerReachable: false,
      latencyMs,
      errorMessage,
    });
  }
}

export async function scanAllWorkspaceNodes(
  workspaceId: string,
  actor: string
): Promise<NodeSnapshotRecord[]> {
  const nodes = nodesRepo.list(workspaceId);
  const tasks: Promise<NodeSnapshotRecord>[] = [
    scanLocalNode(workspaceId),
    ...nodes.map((node) => scanRemoteNode(workspaceId, node, actor)),
  ];

  const results = await Promise.allSettled(tasks);
  const snapshots: NodeSnapshotRecord[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      snapshots.push(r.value);
    }
  }

  return snapshots;
}

export async function getOrDiscoverContainers(
  workspaceId: string,
  actor: string,
  forceRefresh = false
): Promise<DiscoveredContainer[]> {
  const existingSnapshots = nodeHealthRepo.list(workspaceId);
  const now = Date.now();

  const isStale =
    existingSnapshots.length === 0 ||
    existingSnapshots.some((s) => now - s.lastScannedAt > CACHE_TTL_MS);

  if (!forceRefresh && !isStale) {
    return nodeHealthRepo.getAllContainers(workspaceId);
  }

  // If forceRefresh, we await the scan
  if (forceRefresh) {
    await scanAllWorkspaceNodes(workspaceId, actor);
    return nodeHealthRepo.getAllContainers(workspaceId);
  }

  // Otherwise, return cached if available and re-scan in background
  if (existingSnapshots.length > 0) {
    // Return immediately, trigger background refresh
    void scanAllWorkspaceNodes(workspaceId, actor).catch((e) => {
      console.error("[scanner] background scan failed:", e);
    });
    return nodeHealthRepo.getAllContainers(workspaceId);
  }

  // First time with no snapshots at all: must await scan once
  await scanAllWorkspaceNodes(workspaceId, actor);
  return nodeHealthRepo.getAllContainers(workspaceId);
}
