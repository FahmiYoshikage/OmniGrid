import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getDb, prep } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { setUserPassword } from "@/lib/auth/passwords";
import { integrationSettingsRepo } from "@/lib/db/repos/integration-settings";

export interface PreflightStatus {
  nodeVersion: string;
  nodeValid: boolean;
  platform: string;
  databaseHealthy: boolean;
  encryptionReady: boolean;
  dockerAvailable: boolean;
  tailscaleAvailable: boolean;
}

export interface InitialSetupInput {
  username: string;
  displayName?: string;
  password: string;
  email?: string;
  workspaceName?: string;
  tailscaleTailnet?: string;
  tailscaleApiKey?: string;
  cloudflareAccountId?: string;
  cloudflareTunnelToken?: string;
}

export function isSetupNeeded(): boolean {
  const db = getDb();
  try {
    // 1. Check if users table is empty
    const userRow = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number } | undefined;
    if (!userRow || userRow.c === 0) return true;

    // 2. Check if setup_completed is marked in system_settings
    const settingRow = db
      .prepare("SELECT value FROM system_settings WHERE key = 'setup_completed'")
      .get() as { value: string } | undefined;
    if (settingRow && settingRow.value === "true") {
      return false;
    }

    // 3. If users exist and at least one has owner role, consider setup done
    const ownerRow = db
      .prepare("SELECT COUNT(*) as c FROM workspace_members WHERE role = 'owner'")
      .get() as { c: number } | undefined;
    return !ownerRow || ownerRow.c === 0;
  } catch {
    return true;
  }
}

export function getPreflightChecks(): PreflightStatus {
  const nodeMajor = parseInt(process.versions.node.split(".")[0] || "0", 10);
  const nodeValid = nodeMajor >= 20;

  let databaseHealthy = false;
  try {
    const db = getDb();
    const result = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    databaseHealthy = Boolean(result && result[0]?.integrity_check === "ok");
  } catch {
    databaseHealthy = false;
  }

  let encryptionReady = false;
  try {
    const env = getEnv();
    const key = env.OMNIGRID_MASTER_KEY;
    encryptionReady = typeof key === "string" && key.length === 64 && /^[0-9a-fA-F]+$/.test(key);
  } catch {
    encryptionReady = false;
  }

  const dockerAvailable = existsSync("/var/run/docker.sock");
  const tailscaleAvailable = existsSync("/var/run/tailscale/tailscaled.sock");

  return {
    nodeVersion: process.version,
    nodeValid,
    platform: `${process.platform} (${process.arch})`,
    databaseHealthy,
    encryptionReady,
    dockerAvailable,
    tailscaleAvailable,
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "workspace";
}

export function completeInitialSetup(input: InitialSetupInput): { userId: string; workspaceId: string } {
  if (!isSetupNeeded()) {
    throw new Error("Initial system setup has already been completed.");
  }

  const rawUsername = input.username.trim().toLowerCase();
  const username = rawUsername.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  if (!username || username.length < 3) {
    throw new Error("Username must be at least 3 characters and contain only alphanumeric characters or hyphens.");
  }

  if (!input.password || input.password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const displayName = input.displayName?.trim() || username;
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  const workspaceName = input.workspaceName?.trim() || "Primary Fleet";
  const workspaceSlug = slugify(workspaceName);

  const db = getDb();
  const now = Date.now();
  const userId = randomUUID();
  const workspaceId = randomUUID();

  const tx = db.transaction(() => {
    // 1. Create root admin user with synthetic github_id -1
    prep<[string, number, string, string, string | null, number, number]>(
      `INSERT INTO users (id, github_id, username, display_name, email, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
    ).run(userId, -1, username, displayName, email, now, now);

    // 2. Set admin password
    setUserPassword(userId, input.password);

    // 3. Create default primary workspace
    prep<[string, string, string, string, number, number]>(
      `INSERT INTO workspaces (id, owner_id, name, slug, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(workspaceId, userId, workspaceName, workspaceSlug, now, now);

    // 4. Assign user as owner
    prep<[string, string, number, number]>(
      `INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
       VALUES (?, ?, 'owner', ?, ?)`
    ).run(workspaceId, userId, now, now);

    // 5. Mark setup as completed in system_settings
    prep<[number, number, number]>(
      `INSERT INTO system_settings (key, value, created_at, updated_at)
       VALUES ('setup_completed', 'true', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = ?`
    ).run(now, now, now);

    prep<[string, number, number]>(
      `INSERT INTO system_settings (key, value, created_at, updated_at)
       VALUES ('setup_timestamp', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(now.toString(), now, now);
  });

  tx();

  // 6. Optional Tailscale integration
  if (input.tailscaleTailnet?.trim()) {
    integrationSettingsRepo.updateTailscale(workspaceId, {
      tailnet: input.tailscaleTailnet.trim(),
      apiKey: input.tailscaleApiKey?.trim() || undefined,
    });
  }

  // 7. Optional Cloudflare integration
  if (input.cloudflareAccountId?.trim()) {
    integrationSettingsRepo.updateCloudflare(workspaceId, {
      accountId: input.cloudflareAccountId.trim(),
      tunnelToken: input.cloudflareTunnelToken?.trim() || undefined,
    });
  }

  return { userId, workspaceId };
}
