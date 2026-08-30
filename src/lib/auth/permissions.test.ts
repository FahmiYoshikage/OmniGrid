import { describe, expect, it } from "vitest";
import { hasPermission, type Permission, type WorkspaceRole } from "./permissions";

const permissions: Permission[] = [
  "workspace.read", "workspace.manage", "members.manage", "nodes.read", "nodes.manage",
  "credentials.read", "credentials.manage", "terminal.open", "runbooks.read", "runbooks.manage",
  "runbooks.execute", "containers.manage", "uptime.read", "uptime.manage", "integrations.manage",
  "cloudflare.manage", "wol.send", "audit.read",
];

const expectedPermissions: Record<WorkspaceRole, Permission[]> = {
  owner: permissions,
  admin: [
    "workspace.read", "members.manage", "nodes.read", "nodes.manage", "credentials.read", "credentials.manage",
    "terminal.open", "runbooks.read", "runbooks.manage", "runbooks.execute", "containers.manage", "uptime.read",
    "uptime.manage", "integrations.manage", "cloudflare.manage", "wol.send", "audit.read",
  ],
  operator: [
    "workspace.read", "nodes.read", "credentials.read", "terminal.open", "runbooks.read", "runbooks.execute",
    "containers.manage", "uptime.read", "uptime.manage", "wol.send", "audit.read",
  ],
  viewer: ["workspace.read", "nodes.read", "credentials.read", "runbooks.read", "uptime.read", "audit.read"],
};

describe("workspace RBAC permission matrix", () => {
  for (const [role, expected] of Object.entries(expectedPermissions) as Array<[WorkspaceRole, Permission[]]>) {
    it(`grants only the intended permissions to ${role}`, () => {
      const granted = permissions.filter((permission) => hasPermission({ role }, permission));
      expect(granted).toEqual(expected);
    });
  }
});
