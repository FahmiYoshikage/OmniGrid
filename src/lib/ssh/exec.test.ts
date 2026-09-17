import { beforeAll, describe, expect, it } from "vitest";
import { execSsh, SshExecError } from "./exec";
import { migrate } from "@/lib/db/migrate";
import type { NodeRow } from "@/lib/db/repos/nodes";

beforeAll(() => {
  migrate();
});

describe("execSsh", () => {
  it("rejects immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      execSsh({
        node: "dummy-node-id",
        workspaceId: "dummy-workspace",
        command: "uptime",
        signal: controller.signal,
      }),
    ).rejects.toThrowError(SshExecError);

    try {
      await execSsh({
        node: "dummy-node-id",
        workspaceId: "dummy-workspace",
        command: "uptime",
        signal: controller.signal,
      });
    } catch (err) {
      expect((err as SshExecError).code).toBe("ABORTED");
    }
  });

  it("throws NODE_NOT_FOUND if node does not exist in workspace", async () => {
    try {
      await execSsh({
        node: "non-existent-uuid",
        workspaceId: "dummy-ws",
        command: "whoami",
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SshExecError);
      expect((err as SshExecError).code).toBe("NODE_NOT_FOUND");
    }
  });

  it("throws AUTH_FAILED if node configuration has invalid auth", async () => {
    const brokenNode: NodeRow = {
      id: "node-1",
      workspace_id: "ws-1",
      name: "Broken",
      hostname: "127.0.0.1",
      tailscale_id: null,
      os: "linux",
      tags: null,
      ssh_port: 22,
      ssh_user: "root",
      ssh_mode: "password",
      credential_id: null, // missing credential!
      mac_address: null,
      wol_broadcast: null,
      notes: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    try {
      await execSsh({
        node: brokenNode,
        workspaceId: "ws-1",
        command: "uptime",
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SshExecError);
      expect((err as SshExecError).code).toBe("AUTH_FAILED");
    }
  });
});
