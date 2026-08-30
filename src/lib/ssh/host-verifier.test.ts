import { rmSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { nodesRepo } from "@/lib/db/repos/nodes";
import { sshHostKeysRepo } from "@/lib/db/repos/ssh-host-keys";
import { workspacesRepo } from "@/lib/db/repos/workspaces";
import { auditRepo } from "@/lib/db/repos/audit";
import { createHostVerifier, formatHostFingerprint, verifyHostFingerprint } from "./host-verifier";

function createWorkspace(): { id: string; userId: string } {
  const userId = "host-key-user";
  const now = Date.now();
  getDb().prepare(
    `INSERT INTO users (id, github_id, username, display_name, email, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(userId, 101, "host-key", now, now);
  return { id: workspacesRepo.ensureDefaultForUser(userId, "host-key").id, userId };
}

describe("SSH host verifier", () => {
  beforeAll(() => migrate());
  beforeEach(() => getDb().prepare("DELETE FROM users").run());
  afterAll(() => {
    const dbPath = process.env.OMNIGRID_DB_PATH!;
    getDb().close();
    delete globalThis.__omnigridDb;
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
  });

  it("blocks and stores an unknown key as pending", () => {
    const workspace = createWorkspace();
    const node = nodesRepo.create({ name: "host-key-node", hostname: "node.internal" }, workspace.id);

    expect(verifyHostFingerprint(workspace.id, node.id, "operator", "unknown-key")).toBe("pending");
    expect(sshHostKeysRepo.list(workspace.id, node.id)).toMatchObject([
      { fingerprint: "SHA256:unknown-key", status: "pending" },
    ]);
    expect(auditRepo.recent(10, workspace.id)[0]).toMatchObject({ action: "ssh.host_key.pending", node_id: node.id });
  });

  it("allows only a trusted exact fingerprint and blocks mismatches", () => {
    const workspace = createWorkspace();
    const node = nodesRepo.create({ name: "trusted-node", hostname: "trusted.internal" }, workspace.id);
    verifyHostFingerprint(workspace.id, node.id, "operator", "trusted-key");
    const pending = sshHostKeysRepo.list(workspace.id, node.id)[0];
    sshHostKeysRepo.trust(workspace.id, node.id, pending.id, workspace.userId);

    expect(createHostVerifier(workspace.id, node.id, "operator")("trusted-key")).toBe(true);
    expect(verifyHostFingerprint(workspace.id, node.id, "operator", "other-key")).toBe("mismatch");
    expect(createHostVerifier(workspace.id, node.id, "operator")("other-key")).toBe(false);
  });

  it("blocks revoked keys and keeps host-key records workspace-scoped", () => {
    const workspace = createWorkspace();
    const node = nodesRepo.create({ name: "revoked-node", hostname: "revoked.internal" }, workspace.id);
    verifyHostFingerprint(workspace.id, node.id, "operator", "revoked-key");
    const pending = sshHostKeysRepo.list(workspace.id, node.id)[0];
    sshHostKeysRepo.trust(workspace.id, node.id, pending.id, workspace.userId);
    sshHostKeysRepo.revoke(workspace.id, node.id, pending.id, workspace.userId);

    expect(verifyHostFingerprint(workspace.id, node.id, "operator", "revoked-key")).toBe("revoked");
    expect(sshHostKeysRepo.list("other-workspace", node.id)).toEqual([]);
    expect(formatHostFingerprint("SHA256:abc")).toBe("SHA256:abc");
  });
});
