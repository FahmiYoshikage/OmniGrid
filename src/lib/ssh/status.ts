export type SshStatusCode =
  | "resolving-node"
  | "auth-ready"
  | "tcp-connecting"
  | "ssh-ready"
  | "pty-ready"
  | "closed";

export interface SshStatusEvent {
  sessionId?: string;
  nodeId: string;
  code: SshStatusCode;
  label: string;
  detail?: string;
  at: number;
}

export function explainSshError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("all configured authentication methods failed")) {
    return "SSH auth failed. Make sure this machine's SSH agent/default key is accepted by the target user, or use stored key/password mode.";
  }
  if (m.includes("no ssh agent") || m.includes("no ~/.ssh")) {
    return "No SSH credentials available for tailscale mode. Start ssh-agent + ssh-add, add ~/.ssh/id_ed25519, or use key/password mode.";
  }
  if (m.includes("timed out") || m.includes("etimedout") || m.includes("ready timeout")) {
    return "Connection timed out. Check Tailscale is connected, the target is online, and TCP/22 is reachable.";
  }
  if (m.includes("econnrefused") || m.includes("connection refused")) {
    return "TCP/22 refused. SSH server may not be running on the target or the port is wrong.";
  }
  if (m.includes("host key")) {
    return "Host key verification issue. Try connecting once from a shell with ssh to accept/repair known_hosts.";
  }
  if (m.includes("node not found")) {
    return "Node is missing from OmniGrid DB. Add it again from the Nodes page.";
  }
  return "Check the dev server logs and verify plain `ssh user@tailscale-ip` works from this same machine.";
}
