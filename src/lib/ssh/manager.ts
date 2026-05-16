import { Client, type ClientChannel, type ConnectConfig } from "ssh2";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { nodesRepo, type NodeRow } from "@/lib/db/repos/nodes";
import { credentialsRepo } from "@/lib/db/repos/credentials";
import { auditRepo } from "@/lib/db/repos/audit";
import type { SshStatusEvent, SshStatusCode } from "@/lib/ssh/status";

/**
 * Lifecycle manager for interactive SSH/PTY sessions.
 *
 * One Session = one ssh2.Client + one shell channel + one socket.io socket.
 * Sessions self-evict after IDLE_MS without input. A periodic sweeper closes
 * orphans even if a socket disconnect event was missed.
 */

export const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const SWEEP_MS = 60 * 1000;             // every minute

export interface SessionInfo {
  id: string;
  nodeId: string;
  actor: string;
  startedAt: number;
  lastActivity: number;
}

export interface SessionHandlers {
  onData: (chunk: string) => void;
  onClose: (reason: string) => void;
  onError: (err: string) => void;
  onStatus?: (event: SshStatusEvent) => void;
}

interface InternalSession extends SessionInfo {
  client: Client;
  channel: ClientChannel;
}

declare global {
  // eslint-disable-next-line no-var
  var __omnigridSshSessions: Map<string, InternalSession> | undefined;
  // eslint-disable-next-line no-var
  var __omnigridSshSweeper: NodeJS.Timeout | undefined;
}

function store(): Map<string, InternalSession> {
  if (!globalThis.__omnigridSshSessions) {
    globalThis.__omnigridSshSessions = new Map();
  }
  if (!globalThis.__omnigridSshSweeper) {
    globalThis.__omnigridSshSweeper = setInterval(() => {
      const now = Date.now();
      for (const s of globalThis.__omnigridSshSessions!.values()) {
        if (now - s.lastActivity > IDLE_MS) {
          // eslint-disable-next-line no-console
          console.log(`[ssh] idle-evict ${s.id} (node=${s.nodeId})`);
          closeSession(s.id, "idle-timeout");
        }
      }
    }, SWEEP_MS);
    // Don't keep the process alive solely for the sweeper.
    globalThis.__omnigridSshSweeper.unref?.();
  }
  return globalThis.__omnigridSshSessions;
}

/** Look for a usable default SSH private key on the host (in priority order). */
function discoverDefaultKey(): Buffer | null {
  const candidates = [
    "id_ed25519",
    "id_ecdsa",
    "id_rsa",
  ].map((f) => join(homedir(), ".ssh", f));
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return readFileSync(p);
      } catch {
        /* unreadable — skip */
      }
    }
  }
  return null;
}

interface AuthBundle extends Pick<ConnectConfig, "username" | "privateKey" | "passphrase" | "password" | "agent" | "tryKeyboard"> {
  /** Human-readable auth method label for diagnostics. */
  methodLabel: string;
}

function buildAuth(node: NodeRow): AuthBundle {
  const username = node.ssh_user ?? "root";

  if (node.ssh_mode === "password") {
    if (!node.credential_id) throw new Error("password mode requires a credential_id");
    const c = credentialsRepo.reveal(node.credential_id);
    if (!c) throw new Error("credential not found");
    return { username, password: c.secret, tryKeyboard: true, methodLabel: "password" };
  }

  if (node.ssh_mode === "key") {
    if (!node.credential_id) throw new Error("key mode requires a credential_id");
    const c = credentialsRepo.reveal(node.credential_id);
    if (!c) throw new Error("credential not found");
    return {
      username,
      privateKey: Buffer.from(c.secret, "utf8"),
      passphrase: c.passphrase ?? undefined,
      methodLabel: "stored-key",
    };
  }

  // "tailscale" mode: assume connectivity is already provided by the tailnet
  // and reuse whatever auth the host machine has available. In order:
  //   1. SSH agent (if SSH_AUTH_SOCK is set)
  //   2. ~/.ssh/id_ed25519 / id_ecdsa / id_rsa
  // This is what "ssh user@tailscale-ip" would do on the CLI.
  const agent = process.env.SSH_AUTH_SOCK;
  if (agent) {
    return { username, agent, methodLabel: `agent (${agent})` };
  }
  const key = discoverDefaultKey();
  if (key) {
    return { username, privateKey: key, methodLabel: "~/.ssh default key" };
  }
  throw new Error(
    "tailscale mode: no SSH agent (SSH_AUTH_SOCK) and no ~/.ssh/id_* key found. " +
      "Either start ssh-agent, place a key in ~/.ssh/, or switch the node to 'key'/'password' mode.",
  );
}

export interface OpenOpts {
  nodeId: string;
  actor: string;
  cols: number;
  rows: number;
  handlers: SessionHandlers;
}

export async function openSession(opts: OpenOpts): Promise<SessionInfo> {
  const id = randomUUID();
  const emitStatus = (code: SshStatusCode, label: string, detail?: string) => {
    opts.handlers.onStatus?.({
      sessionId: id,
      nodeId: opts.nodeId,
      code,
      label,
      detail,
      at: Date.now(),
    });
  };

  emitStatus("resolving-node", "Resolving OmniGrid node", opts.nodeId);
  const node = nodesRepo.get(opts.nodeId);
  if (!node) throw new Error(`node not found: ${opts.nodeId}`);

  emitStatus("auth-ready", "Preparing SSH authentication", `${node.ssh_mode} mode`);
  const auth = buildAuth(node);

  const client = new Client();

  return await new Promise<SessionInfo>((resolve, reject) => {
    let settled = false;
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      try {
        client.end();
      } catch {}
      reject(new Error(msg));
    };

    client.on("ready", () => {
      emitStatus("ssh-ready", "SSH handshake complete", `${node.hostname}:${node.ssh_port}`);
      client.shell({ cols: opts.cols, rows: opts.rows, term: "xterm-256color" }, (err, channel) => {
        if (err) return fail(`shell error: ${err.message}`);
        emitStatus("pty-ready", "PTY shell allocated", `${opts.cols}×${opts.rows}`);

        const session: InternalSession = {
          id,
          nodeId: node.id,
          actor: opts.actor,
          startedAt: Date.now(),
          lastActivity: Date.now(),
          client,
          channel,
        };
        store().set(id, session);

        channel.on("data", (data: Buffer) => {
          session.lastActivity = Date.now();
          opts.handlers.onData(data.toString("utf8"));
        });
        channel.on("extended data", (data: Buffer) => {
          opts.handlers.onData(data.toString("utf8"));
        });
        channel.on("close", () => {
          opts.handlers.onClose("channel-closed");
          store().delete(id);
          try {
            client.end();
          } catch {}
          auditRepo.log({
            actor: opts.actor,
            action: "ssh.close",
            node_id: node.id,
            session_id: id,
            detail: { duration_ms: Date.now() - session.startedAt },
          });
        });

        auditRepo.log({
          actor: opts.actor,
          action: "ssh.open",
          node_id: node.id,
          session_id: id,
          detail: {
            hostname: node.hostname,
            ssh_mode: node.ssh_mode,
            auth_method: auth.methodLabel,
          },
        });

        settled = true;
        resolve({
          id,
          nodeId: node.id,
          actor: opts.actor,
          startedAt: session.startedAt,
          lastActivity: session.lastActivity,
        });
      });
    });

    client.on("error", (err) => {
      opts.handlers.onError(err.message);
      fail(err.message);
    });

    const { methodLabel: _ml, ...connectAuth } = auth;
    void _ml;
    emitStatus("tcp-connecting", "Connecting to Tailscale SSH endpoint", `${node.hostname}:${node.ssh_port}`);
    client.connect({
      host: node.hostname,
      port: node.ssh_port,
      readyTimeout: 15_000,
      keepaliveInterval: 30_000,
      ...connectAuth,
    });
  });
}

export function writeToSession(id: string, data: string): boolean {
  const s = store().get(id);
  if (!s) return false;
  s.lastActivity = Date.now();
  s.channel.write(data);
  return true;
}

export function resizeSession(id: string, cols: number, rows: number): boolean {
  const s = store().get(id);
  if (!s) return false;
  s.channel.setWindow(rows, cols, 480, 640);
  return true;
}

export function closeSession(id: string, reason = "user-close"): boolean {
  const s = store().get(id);
  if (!s) return false;
  try {
    s.channel.close();
  } catch {}
  try {
    s.client.end();
  } catch {}
  store().delete(id);
  auditRepo.log({
    actor: s.actor,
    action: "ssh.close",
    node_id: s.nodeId,
    session_id: id,
    detail: { reason, duration_ms: Date.now() - s.startedAt },
  });
  return true;
}

export function listSessions(): SessionInfo[] {
  return [...store().values()].map((s) => ({
    id: s.id,
    nodeId: s.nodeId,
    actor: s.actor,
    startedAt: s.startedAt,
    lastActivity: s.lastActivity,
  }));
}
