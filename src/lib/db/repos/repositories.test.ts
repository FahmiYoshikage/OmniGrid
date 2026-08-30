import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUserFromCookieHeader, getSessionUserFromToken, SESSION_COOKIE } from "@/lib/auth/session";
import { encrypt, sha256Hex } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { credentialsRepo } from "./credentials";
import { integrationSettingsRepo } from "./integration-settings";
import { nodesRepo } from "./nodes";
import { runbooksRepo } from "./runbooks";
import { workspacesRepo } from "./workspaces";

const invitationSession = vi.hoisted(() => ({
  user: null as {
    id: string;
    username: string;
    email: string | null;
    workspaceId: string;
  } | null,
}));

vi.mock("@/lib/auth/api", () => ({
  requireApiSession: () => Promise.resolve({ user: invitationSession.user, response: null }),
}));

import { POST as acceptInvitation } from "@/app/api/workspace/invitations/[token]/accept/route";

interface TestWorkspace {
  id: string;
  ownerId: string;
}

function createWorkspace(suffix: string): TestWorkspace {
  const db = getDb();
  const ownerId = `user-${suffix}`;
  const now = Date.now();
  db.prepare(
    `INSERT INTO users
      (id, github_id, username, display_name, email, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(ownerId, suffix === "one" ? 1 : 2, suffix, now, now);
  return {
    id: workspacesRepo.ensureDefaultForUser(ownerId, suffix).id,
    ownerId,
  };
}

beforeAll(() => {
  migrate();
});

beforeEach(() => {
  getDb().prepare("DELETE FROM users").run();
});

afterAll(() => {
  const dbPath = process.env.OMNIGRID_DB_PATH!;
  getDb().close();
  delete globalThis.__omnigridDb;
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
});

describe("workspace-scoped repositories", () => {
  it("backfills and preserves an owner membership for a new workspace", () => {
    const workspace = createWorkspace("one");
    expect(workspacesRepo.getMembership(workspace.id, workspace.ownerId)?.role).toBe("owner");
  });

  it("backfills owner membership for workspaces that predate RBAC", () => {
    const workspace = createWorkspace("one");
    const db = getDb();
    db.prepare("DELETE FROM workspace_members WHERE workspace_id = ?").run(workspace.id);

    db.exec(readFileSync(join(process.cwd(), "src/lib/db/migrations/009_rbac.sql"), "utf8"));

    expect(workspacesRepo.getMembership(workspace.id, workspace.ownerId)).toEqual({ role: "owner" });
  });
  it("keeps credential secrets encrypted and inaccessible across workspaces", () => {
    const first = createWorkspace("one");
    const second = createWorkspace("two");
    const credential = credentialsRepo.create(
      {
        label: "Production key",
        kind: "ssh_key",
        secret: "private-key-material",
        passphrase: "key-passphrase",
      },
      first.id,
    );

    const stored = getDb()
      .prepare("SELECT secret_enc, passphrase_enc FROM credentials WHERE id = ?")
      .get(credential.id) as { secret_enc: string; passphrase_enc: string };

    expect(stored.secret_enc).not.toContain("private-key-material");
    expect(stored.passphrase_enc).not.toContain("key-passphrase");
    expect(credentialsRepo.list(first.id)).toEqual([credential]);
    expect(credentialsRepo.list(second.id)).toEqual([]);
    expect(credentialsRepo.get(credential.id, second.id)).toBeUndefined();
    expect(credentialsRepo.reveal(credential.id, second.id)).toBeNull();
    expect(credentialsRepo.reveal(credential.id, first.id)).toEqual({
      secret: "private-key-material",
      passphrase: "key-passphrase",
    });

    expect(
      credentialsRepo.update(
        credential.id,
        { label: "Hijacked", kind: "password", secret: "replacement" },
        second.id,
      ),
    ).toBeUndefined();
    credentialsRepo.delete(credential.id, second.id);
    expect(credentialsRepo.get(credential.id, first.id)?.label).toBe("Production key");
  });

  it("scopes node mutation and deletion to the owning workspace", () => {
    const first = createWorkspace("one");
    const second = createWorkspace("two");
    const node = nodesRepo.create(
      { name: "primary", hostname: "primary.internal", tags: ["linux", "prod"] },
      first.id,
    );

    expect(nodesRepo.list(first.id)).toHaveLength(1);
    expect(nodesRepo.list(second.id)).toEqual([]);
    expect(nodesRepo.get(node.id, second.id)).toBeUndefined();
    expect(
      nodesRepo.update(node.id, { name: "other", hostname: "other.internal" }, second.id),
    ).toBeUndefined();

    nodesRepo.delete(node.id, second.id);
    expect(nodesRepo.get(node.id, first.id)).toMatchObject({
      name: "primary",
      tags: '["linux","prod"]',
    });
  });

  it("only reveals runbook bodies to the owning workspace", () => {
    const first = createWorkspace("one");
    const second = createWorkspace("two");
    const runbook = runbooksRepo.create(
      { name: "Deploy", description: " production ", body: "echo $TOKEN" },
      first.id,
    );

    const stored = getDb()
      .prepare("SELECT body_enc FROM runbooks WHERE id = ?")
      .get(runbook.id) as { body_enc: string };

    expect(stored.body_enc).not.toContain("echo $TOKEN");
    expect(runbooksRepo.list(second.id)).toEqual([]);
    expect(runbooksRepo.get(runbook.id, second.id)).toBeUndefined();
    expect(runbooksRepo.get(runbook.id, first.id)).toMatchObject({
      description: "production",
      body: "echo $TOKEN",
      shell: "bash",
    });
    expect(runbooksRepo.delete(runbook.id, second.id)).toBe(false);
    expect(runbooksRepo.get(runbook.id, first.id)).toBeDefined();
  });

  it("isolates integration settings and supports explicit secret clearing", () => {
    const first = createWorkspace("one");
    const second = createWorkspace("two");

    integrationSettingsRepo.updateTailscale(first.id, {
      tailnet: " example.ts.net ",
      apiKey: " ts-secret ",
    });

    expect(integrationSettingsRepo.getTailscalePublic(first.id)).toMatchObject({
      tailnet: "example.ts.net",
      hasApiKey: true,
    });
    expect(integrationSettingsRepo.revealTailscale(first.id).apiKey).toBe("ts-secret");
    expect(integrationSettingsRepo.revealTailscale(second.id)).toMatchObject({
      tailnet: "",
      hasApiKey: false,
      apiKey: null,
    });

    integrationSettingsRepo.updateTailscale(first.id, {
      tailnet: "example.ts.net",
      clearApiKey: true,
    });
    expect(integrationSettingsRepo.revealTailscale(first.id).apiKey).toBeNull();
  });
});

describe("workspace invitations", () => {
  function insertInvitation(workspace: TestWorkspace, email: string, expiresAt: number) {
    const token = `invitation-${email}-${expiresAt}`;
    getDb().prepare(
      `INSERT INTO workspace_invitations
        (id, workspace_id, email, role, token_hash, invited_by, expires_at, created_at)
       VALUES (?, ?, ?, 'operator', ?, ?, ?, ?)`,
    ).run(`invite-${email}-${expiresAt}`, workspace.id, email, sha256Hex(token), workspace.ownerId, expiresAt, Date.now());
    return token;
  }

  it("rejects an expired invitation token without adding a membership", async () => {
    const workspace = createWorkspace("one");
    const token = insertInvitation(workspace, "invitee@example.com", Date.now() - 1);
    invitationSession.user = {
      id: "invitee",
      username: "invitee",
      email: "invitee@example.com",
      workspaceId: workspace.id,
    };

    const response = await acceptInvitation(new Request("http://test"), { params: Promise.resolve({ token }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Invitation is invalid or does not match your account" });
    expect(workspacesRepo.getMembership(workspace.id, "invitee")).toBeUndefined();
  });

  it("rejects an invitation accepted from a different email address", async () => {
    const workspace = createWorkspace("one");
    const token = insertInvitation(workspace, "invitee@example.com", Date.now() + 60_000);
    invitationSession.user = {
      id: "other-user",
      username: "other",
      email: "other@example.com",
      workspaceId: workspace.id,
    };

    const response = await acceptInvitation(new Request("http://test"), { params: Promise.resolve({ token }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Invitation is invalid or does not match your account" });
    expect(workspacesRepo.getMembership(workspace.id, "other-user")).toBeUndefined();
  });
});

describe("session cookie resolution", () => {
  it("authenticates a valid encrypted cookie and rejects invalid or expired sessions", () => {
    const workspace = createWorkspace("one");
    const token = "socket-session-token";
    const encryptedToken = encrypt(token);
    const db = getDb();
    db.prepare(
      "INSERT INTO auth_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    ).run(sha256Hex(token), workspace.ownerId, Date.now() + 60_000, Date.now());

    expect(getSessionUserFromToken(encryptedToken)).toMatchObject({
      id: workspace.ownerId,
      username: "one",
      workspaceId: workspace.id,
    });
    expect(getSessionUserFromCookieHeader(`theme=dark; ${SESSION_COOKIE}=${encodeURIComponent(encryptedToken)}`))
      .toMatchObject({ id: workspace.ownerId, workspaceId: workspace.id });
    expect(getSessionUserFromToken("not-encrypted")).toBeNull();

    db.prepare("UPDATE auth_sessions SET expires_at = ? WHERE id = ?")
      .run(Date.now() - 1, sha256Hex(token));
    expect(getSessionUserFromToken(encryptedToken)).toBeNull();
  });
});
