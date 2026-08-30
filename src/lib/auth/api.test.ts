import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "./session";

const session = vi.hoisted(() => ({ user: null as SessionUser | null }));

vi.mock("./session", () => ({
  getSessionUser: () => Promise.resolve(session.user),
}));

import { requireApiPermission } from "./api";

const viewer: SessionUser = {
  id: "viewer-id",
  username: "viewer",
  displayName: null,
  email: "viewer@example.com",
  avatarUrl: null,
  workspaceId: "workspace-id",
  role: "viewer",
};

describe("requireApiPermission", () => {
  it("returns a 401 Unauthorized response without a session", async () => {
    session.user = null;

    const result = await requireApiPermission("nodes.read");

    expect(result.user).toBeNull();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns a 403 Forbidden response when the session lacks the permission", async () => {
    session.user = viewer;

    const result = await requireApiPermission("nodes.manage");

    expect(result.user).toBeNull();
    expect(result.response?.status).toBe(403);
    await expect(result.response?.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns the authenticated user with no response when access is allowed", async () => {
    session.user = viewer;

    await expect(requireApiPermission("nodes.read")).resolves.toEqual({ user: viewer, response: null });
  });
});
