import { requireSessionUser } from "@/lib/auth/access";
import { getTailnet } from "@/lib/tailscale/client";
import { ContainersClient } from "./containers-client";

export const runtime = "nodejs";

export default async function ContainersPage() {
  const user = await requireSessionUser();
  const snapshot = await getTailnet({ workspaceId: user.workspaceId }).catch(() => null);
  return <ContainersClient snapshot={snapshot} />;
}
