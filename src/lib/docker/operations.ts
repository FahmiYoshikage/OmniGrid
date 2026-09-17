import { exec } from "node:child_process";
import { promisify } from "node:util";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { execSsh } from "@/lib/ssh/exec";
import { auditRepo } from "@/lib/db/repos/audit";

const execAsync = promisify(exec);

export type ContainerAction = "start" | "stop" | "restart";

const CONTAINER_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,128}$/;

export interface ContainerActionOptions {
  workspaceId: string;
  nodeId: string;
  containerId: string;
  action: ContainerAction;
  actor: string;
}

export interface ContainerLogsOptions {
  workspaceId: string;
  nodeId: string;
  containerId: string;
  actor: string;
  tail?: number;
}

export interface ContainerActionResult {
  ok: boolean;
  action: ContainerAction;
  containerId: string;
  nodeId: string;
  output?: string;
  error?: string;
}

export interface ContainerLogsResult {
  ok: boolean;
  containerId: string;
  nodeId: string;
  logs: string;
  tail: number;
}

export function validateContainerId(id: string): void {
  if (!CONTAINER_ID_REGEX.test(id)) {
    throw new Error("Invalid container identifier");
  }
}

export async function executeContainerAction({
  workspaceId,
  nodeId,
  containerId,
  action,
  actor,
}: ContainerActionOptions): Promise<ContainerActionResult> {
  validateContainerId(containerId);

  if (!["start", "stop", "restart"].includes(action)) {
    throw new Error(`Unsupported container action: ${action}`);
  }

  const command = `docker ${action} ${containerId}`;

  try {
    let output = "";
    if (nodeId === "__local__") {
      const res = await execAsync(command, { timeout: 15_000 });
      output = res.stdout || res.stderr;
    } else {
      const node = nodesRepo.get(nodeId, workspaceId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);

      const res = await execSsh({
        node,
        command,
        workspaceId,
        actor,
        timeoutMs: 20_000,
      });
      output = res.stdout || res.stderr;
    }

    auditRepo.log({
      workspaceId,
      actor,
      action: `container.${action}`,
      node_id: nodeId === "__local__" ? undefined : nodeId,
      detail: { containerId, action, output: output.slice(0, 500) },
    });

    return {
      ok: true,
      action,
      containerId,
      nodeId,
      output: output.trim(),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    auditRepo.log({
      workspaceId,
      actor,
      action: `container.${action}.failed`,
      node_id: nodeId === "__local__" ? undefined : nodeId,
      detail: { containerId, action, error: errorMsg },
    });

    return {
      ok: false,
      action,
      containerId,
      nodeId,
      error: errorMsg,
    };
  }
}

export async function getContainerLogs({
  workspaceId,
  nodeId,
  containerId,
  actor,
  tail = 150,
}: ContainerLogsOptions): Promise<ContainerLogsResult> {
  validateContainerId(containerId);

  const boundedTail = Math.min(Math.max(Number(tail) || 100, 10), 1000);
  const command = `docker logs --tail ${boundedTail} --timestamps ${containerId}`;

  let logs = "";
  if (nodeId === "__local__") {
    try {
      const res = await execAsync(command, { timeout: 10_000, maxBuffer: 1024 * 1024 });
      logs = res.stdout || res.stderr;
    } catch (err: unknown) {
      // docker logs writes to stderr on many setups
      const anyErr = err as { stdout?: string; stderr?: string; message?: string };
      logs = anyErr.stderr || anyErr.stdout || anyErr.message || "Failed to read logs";
    }
  } else {
    const node = nodesRepo.get(nodeId, workspaceId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const res = await execSsh({
      node,
      command,
      workspaceId,
      actor,
      timeoutMs: 15_000,
      maxOutputBytes: 250_000,
    });
    logs = res.stdout || res.stderr;
  }

  return {
    ok: true,
    containerId,
    nodeId,
    logs: logs.trim(),
    tail: boundedTail,
  };
}
