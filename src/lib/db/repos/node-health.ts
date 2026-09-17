import { randomUUID } from "node:crypto";
import { prep } from "@/lib/db/client";

export interface DiscoveredContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports?: string;
  source: string;
  nodeId?: string;
}

export interface NodeSnapshotRecord {
  id: string;
  workspaceId: string;
  nodeId: string;
  sourceName: string;
  containers: DiscoveredContainer[];
  isReachable: boolean;
  dockerReachable: boolean;
  latencyMs: number | null;
  errorMessage: string | null;
  lastScannedAt: number;
  createdAt: number;
  updatedAt: number;
}

interface RawNodeSnapshotRow {
  id: string;
  workspace_id: string;
  node_id: string;
  source_name: string;
  containers_json: string;
  is_reachable: number;
  docker_reachable: number;
  latency_ms: number | null;
  error_message: string | null;
  last_scanned_at: number;
  created_at: number;
  updated_at: number;
}

export interface NodeSnapshotInput {
  workspaceId: string;
  nodeId: string;
  sourceName: string;
  containers: DiscoveredContainer[];
  isReachable: boolean;
  dockerReachable: boolean;
  latencyMs?: number | null;
  errorMessage?: string | null;
}

function mapRow(row: RawNodeSnapshotRow): NodeSnapshotRecord {
  let containers: DiscoveredContainer[] = [];
  try {
    containers = JSON.parse(row.containers_json);
  } catch {
    containers = [];
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    sourceName: row.source_name,
    containers,
    isReachable: Boolean(row.is_reachable),
    dockerReachable: Boolean(row.docker_reachable),
    latencyMs: row.latency_ms,
    errorMessage: row.error_message,
    lastScannedAt: row.last_scanned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const nodeHealthRepo = {
  upsert(input: NodeSnapshotInput): NodeSnapshotRecord {
    const now = Date.now();
    const id = randomUUID();
    const containersJson = JSON.stringify(input.containers);

    prep<[
      string, string, string, string, string, number, number, number | null, string | null, number, number, number,
      string, string, number, number, number | null, string | null, number, number
    ]>(
      `INSERT INTO node_snapshots (
        id, workspace_id, node_id, source_name, containers_json,
        is_reachable, docker_reachable, latency_ms, error_message,
        last_scanned_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, node_id) DO UPDATE SET
        source_name = ?,
        containers_json = ?,
        is_reachable = ?,
        docker_reachable = ?,
        latency_ms = ?,
        error_message = ?,
        last_scanned_at = ?,
        updated_at = ?`
    ).run(
      id,
      input.workspaceId,
      input.nodeId,
      input.sourceName,
      containersJson,
      input.isReachable ? 1 : 0,
      input.dockerReachable ? 1 : 0,
      input.latencyMs ?? null,
      input.errorMessage ?? null,
      now,
      now,
      now,
      // UPDATE SET parameters:
      input.sourceName,
      containersJson,
      input.isReachable ? 1 : 0,
      input.dockerReachable ? 1 : 0,
      input.latencyMs ?? null,
      input.errorMessage ?? null,
      now,
      now,
    );

    return this.get(input.workspaceId, input.nodeId)!;
  },

  get(workspaceId: string, nodeId: string): NodeSnapshotRecord | undefined {
    const row = prep<[string, string]>(
      `SELECT * FROM node_snapshots WHERE workspace_id = ? AND node_id = ?`
    ).get(workspaceId, nodeId) as RawNodeSnapshotRow | undefined;
    return row ? mapRow(row) : undefined;
  },

  list(workspaceId: string): NodeSnapshotRecord[] {
    const rows = prep<[string]>(
      `SELECT * FROM node_snapshots WHERE workspace_id = ? ORDER BY source_name ASC`
    ).all(workspaceId) as RawNodeSnapshotRow[];
    return rows.map(mapRow);
  },

  getAllContainers(workspaceId: string): DiscoveredContainer[] {
    const snapshots = this.list(workspaceId);
    const allContainers: DiscoveredContainer[] = [];
    for (const snap of snapshots) {
      if (snap.dockerReachable && snap.containers.length > 0) {
        allContainers.push(...snap.containers);
      }
    }
    return allContainers;
  },

  delete(workspaceId: string, nodeId: string): void {
    prep<[string, string]>(
      `DELETE FROM node_snapshots WHERE workspace_id = ? AND node_id = ?`
    ).run(workspaceId, nodeId);
  },
};
