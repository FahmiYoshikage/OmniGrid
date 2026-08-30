import type { SessionUser } from "./session";

export type WorkspaceRole = "owner" | "admin" | "operator" | "viewer";
export type Permission =
  | "workspace.read"
  | "workspace.manage"
  | "members.manage"
  | "nodes.read"
  | "nodes.manage"
  | "credentials.read"
  | "credentials.manage"
  | "terminal.open"
  | "runbooks.read"
  | "runbooks.manage"
  | "runbooks.execute"
  | "containers.manage"
  | "uptime.read"
  | "uptime.manage"
  | "integrations.manage"
  | "cloudflare.manage"
  | "wol.send"
  | "audit.read";

const ROLE_PERMISSIONS: Record<WorkspaceRole, Set<Permission>> = {
  owner: new Set([
    "workspace.read", "workspace.manage", "members.manage", "nodes.read", "nodes.manage",
    "credentials.read", "credentials.manage", "terminal.open", "runbooks.read", "runbooks.manage",
    "runbooks.execute", "containers.manage", "uptime.read", "uptime.manage", "integrations.manage",
    "cloudflare.manage", "wol.send", "audit.read",
  ]),
  admin: new Set([
    "workspace.read", "members.manage", "nodes.read", "nodes.manage", "credentials.read", "credentials.manage",
    "terminal.open", "runbooks.read", "runbooks.manage", "runbooks.execute", "containers.manage", "uptime.read",
    "uptime.manage", "integrations.manage", "cloudflare.manage", "wol.send", "audit.read",
  ]),
  operator: new Set([
    "workspace.read", "nodes.read", "credentials.read", "terminal.open", "runbooks.read", "runbooks.execute",
    "containers.manage", "uptime.read", "uptime.manage", "wol.send", "audit.read",
  ]),
  viewer: new Set(["workspace.read", "nodes.read", "credentials.read", "runbooks.read", "uptime.read", "audit.read"]),
};

export function hasPermission(user: Pick<SessionUser, "role">, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role].has(permission);
}
