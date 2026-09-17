import { Client } from "ssh2";
import { nodesRepo, type NodeRow } from "@/lib/db/repos/nodes";
import { buildAuth } from "@/lib/ssh/manager";
import { createHostVerifier } from "@/lib/ssh/host-verifier";

export type SshErrorCode =
  | "NODE_NOT_FOUND"
  | "AUTH_FAILED"
  | "CONNECT_FAILED"
  | "HOST_KEY_REJECTED"
  | "TIMEOUT"
  | "ABORTED"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "EXEC_FAILED";

export class SshExecError extends Error {
  readonly code: SshErrorCode;
  readonly nodeId?: string;
  readonly exitCode?: number | null;

  constructor(message: string, code: SshErrorCode, options?: { nodeId?: string; exitCode?: number | null; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "SshExecError";
    this.code = code;
    this.nodeId = options?.nodeId;
    this.exitCode = options?.exitCode;
  }
}

export interface SshExecOptions {
  node: NodeRow | string;
  workspaceId: string;
  command: string;
  actor?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
}

export interface SshExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_OUTPUT_BYTES = 50 * 1024; // 50 KB

/**
 * Executes a non-interactive command on a remote node via SSH.
 * Guarantees bounded execution time, memory protection via output capping,
 * abort signal handling, and host-key verification.
 */
export async function execSsh(options: SshExecOptions): Promise<SshExecResult> {
  const {
    workspaceId,
    command,
    actor = "system",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    signal,
  } = options;

  if (signal?.aborted) {
    throw new SshExecError("SSH command aborted before start", "ABORTED");
  }

  const node = typeof options.node === "string"
    ? nodesRepo.get(options.node, workspaceId)
    : options.node;

  if (!node) {
    const id = typeof options.node === "string" ? options.node : "unknown";
    throw new SshExecError(`Node not found: ${id}`, "NODE_NOT_FOUND", { nodeId: id });
  }

  const effectiveTimeout = Math.min(Math.max(timeoutMs, 1000), MAX_TIMEOUT_MS);
  const startTime = Date.now();

  let auth;
  try {
    auth = buildAuth(node, workspaceId);
  } catch (err) {
    throw new SshExecError(
      `SSH authentication build failed: ${err instanceof Error ? err.message : String(err)}`,
      "AUTH_FAILED",
      { nodeId: node.id, cause: err },
    );
  }

  const { methodLabel: _methodLabel, ...connectAuth } = auth;
  void _methodLabel;

  return await new Promise<SshExecResult>((resolve, reject) => {
    const client = new Client();
    let settled = false;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let totalBytes = 0;

    const cleanup = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
      try {
        client.end();
      } catch {
        /* ignore */
      }
    };

    const fail = (err: SshExecError) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const succeed = (result: SshExecResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const timer = setTimeout(() => {
      fail(new SshExecError(
        `SSH command timed out after ${effectiveTimeout}ms`,
        "TIMEOUT",
        { nodeId: node.id },
      ));
    }, effectiveTimeout);

    const onAbort = () => {
      fail(new SshExecError("SSH command aborted by signal", "ABORTED", { nodeId: node.id }));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    client.on("ready", () => {
      client.exec(command, (err, stream) => {
        if (err) {
          return fail(new SshExecError(
            `Failed to execute command: ${err.message}`,
            "EXEC_FAILED",
            { nodeId: node.id, cause: err },
          ));
        }

        stream.on("data", (chunk: Buffer) => {
          totalBytes += chunk.byteLength;
          if (totalBytes > maxOutputBytes) {
            return fail(new SshExecError(
              `Command output exceeded limit of ${maxOutputBytes} bytes`,
              "OUTPUT_LIMIT_EXCEEDED",
              { nodeId: node.id },
            ));
          }
          stdoutBuffer += chunk.toString("utf8");
        });

        stream.stderr.on("data", (chunk: Buffer) => {
          totalBytes += chunk.byteLength;
          if (totalBytes > maxOutputBytes) {
            return fail(new SshExecError(
              `Command output exceeded limit of ${maxOutputBytes} bytes`,
              "OUTPUT_LIMIT_EXCEEDED",
              { nodeId: node.id },
            ));
          }
          stderrBuffer += chunk.toString("utf8");
        });

        stream.on("close", (code: number | null, exitSignal: string | null) => {
          succeed({
            stdout: stdoutBuffer,
            stderr: stderrBuffer,
            exitCode: code ?? null,
            signal: exitSignal ?? null,
            durationMs: Date.now() - startTime,
          });
        });
      });
    });

    client.on("error", (err: Error & { level?: string }) => {
      const msg = err.message || "Connection error";
      if (msg.includes("Host key") || msg.includes("verification failed") || msg.includes("rejected")) {
        return fail(new SshExecError(`Host key verification failed: ${msg}`, "HOST_KEY_REJECTED", { nodeId: node.id, cause: err }));
      }
      if (err.level === "client-authentication" || msg.includes("authentication") || msg.includes("All configured authentication methods failed")) {
        return fail(new SshExecError(`Authentication failed: ${msg}`, "AUTH_FAILED", { nodeId: node.id, cause: err }));
      }
      fail(new SshExecError(`SSH connection failed: ${msg}`, "CONNECT_FAILED", { nodeId: node.id, cause: err }));
    });

    try {
      client.connect({
        host: node.hostname,
        port: node.ssh_port,
        hostHash: "sha256",
        hostVerifier: createHostVerifier(workspaceId, node.id, actor),
        readyTimeout: Math.min(effectiveTimeout, 10_000),
        ...connectAuth,
      });
    } catch (err) {
      fail(new SshExecError(
        `Failed to initiate SSH connection: ${err instanceof Error ? err.message : String(err)}`,
        "CONNECT_FAILED",
        { nodeId: node.id, cause: err },
      ));
    }
  });
}
