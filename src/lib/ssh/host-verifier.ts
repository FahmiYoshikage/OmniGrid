import { auditRepo } from "@/lib/db/repos/audit";
import { sshHostKeysRepo, type SshHostKeyStatus } from "@/lib/db/repos/ssh-host-keys";

export type HostKeyVerification = "trusted" | "pending" | "mismatch" | "revoked";

export function formatHostFingerprint(hash: string): string {
  return `SHA256:${hash.replace(/^SHA256:/, "")}`;
}

export function verifyHostFingerprint(
  workspaceId: string,
  nodeId: string,
  actor: string,
  hash: string,
): HostKeyVerification {
  const fingerprint = formatHostFingerprint(hash);
  const observed = sshHostKeysRepo.observe(workspaceId, nodeId, fingerprint);
  let result: HostKeyVerification;
  if (observed.status === "trusted") result = "trusted";
  else if (observed.status === "revoked") result = "revoked";
  else {
    const statuses = sshHostKeysRepo.list(workspaceId, nodeId).map((key) => key.status);
    result = statuses.includes("trusted" as SshHostKeyStatus) ? "mismatch" : "pending";
  }
  if (result !== "trusted") {
    auditRepo.log({
      workspaceId,
      actor,
      action: `ssh.host_key.${result}`,
      node_id: nodeId,
      detail: { fingerprint },
    });
  }
  return result;
}

export function createHostVerifier(workspaceId: string, nodeId: string, actor: string): (hash: string) => boolean {
  return (hash) => verifyHostFingerprint(workspaceId, nodeId, actor, hash) === "trusted";
}
