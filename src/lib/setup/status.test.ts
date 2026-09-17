import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { completeInitialSetup, getPreflightChecks, isSetupNeeded } from "./status";
import { verifyUserCredentials } from "@/lib/auth/passwords";

beforeAll(() => {
  migrate();
});

afterAll(() => {
  // Clean up any test users and reset system settings if needed
  const db = getDb();
  db.prepare("DELETE FROM users WHERE username = 'test-superadmin'").run();
  db.prepare("DELETE FROM system_settings WHERE key IN ('setup_completed', 'setup_timestamp')").run();
});

describe("initial system setup and preflight verification", () => {
  it("provides valid preflight check information", () => {
    const preflight = getPreflightChecks();

    expect(preflight.nodeVersion).toBeDefined();
    expect(preflight.nodeValid).toBe(true);
    expect(preflight.platform).toBeDefined();
    expect(preflight.databaseHealthy).toBe(true);
    expect(typeof preflight.encryptionReady).toBe("boolean");
    expect(typeof preflight.dockerAvailable).toBe("boolean");
    expect(typeof preflight.tailscaleAvailable).toBe("boolean");
  });

  it("completes initial setup, creates user, password, and locks down subsequent setup attempts", () => {
    const db = getDb();
    // Temporarily ensure system_settings is clean for test
    db.prepare("DELETE FROM system_settings WHERE key = 'setup_completed'").run();

    // Setup input
    const result = completeInitialSetup({
      username: "test-superadmin",
      displayName: "Super Administrator",
      password: "MasterSecurePassword!123",
      email: "superadmin@omnigrid.internal",
      workspaceName: "Main Test Fleet",
    });

    expect(result.userId).toBeDefined();
    expect(result.workspaceId).toBeDefined();

    // Verify user can authenticate with password
    const verified = verifyUserCredentials("test-superadmin", "MasterSecurePassword!123");
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(result.userId);
    expect(verified?.username).toBe("test-superadmin");

    // Verify workspace membership is owner
    const member = db
      .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(result.workspaceId, result.userId) as { role: string };
    expect(member.role).toBe("owner");

    // Verify setup is now NOT needed
    expect(isSetupNeeded()).toBe(false);

    // Verify lockdown: attempting to run completeInitialSetup again must throw an error
    expect(() =>
      completeInitialSetup({
        username: "another-admin",
        password: "Password123456!",
      })
    ).toThrow("Initial system setup has already been completed");
  });
});
