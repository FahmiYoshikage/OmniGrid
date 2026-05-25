import Link from "next/link";
import { Cloud } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { requireSessionUser } from "@/lib/auth/access";
import { integrationSettingsRepo } from "@/lib/db/repos/integration-settings";
import { getEnv } from "@/lib/env";
import { TunnelsClient } from "./tunnels-client";

export const dynamic = "force-dynamic";

export default async function TunnelsPage() {
  const user = await requireSessionUser();
  const settings = integrationSettingsRepo.getCloudflarePublic(user.workspaceId);
  const env = getEnv();
  const publicUrl = env.OMNIGRID_PUBLIC_URL ? new URL(env.OMNIGRID_PUBLIC_URL) : null;
  const publicHost = publicUrl?.host ?? "your-domain.example.com";
  const publicOrigin = publicUrl?.origin ?? "https://your-domain.example.com";
  const readiness = {
    account: Boolean(settings.accountId.trim()),
    tunnelToken: settings.hasTunnelToken,
    apiToken: settings.hasApiToken,
    publicUrl: Boolean(publicUrl),
  };
  const readyCount = Object.values(readiness).filter(Boolean).length;
  const zoneHint = publicHost.includes(":") ? publicHost.split(":")[0] : publicHost;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Cloudflare Tunnel"
        description="Publish OmniGrid through Cloudflare Zero Trust without exposing inbound ports."
        actions={
          <Link href="/settings">
            <Button>
              <Cloud className="mr-2 h-4 w-4" /> Configure settings
            </Button>
          </Link>
        }
      />

      <TunnelsClient
        settings={settings}
        publicOrigin={publicOrigin}
        publicHost={publicHost}
        zoneHint={zoneHint}
        readiness={readiness}
        readyCount={readyCount}
      />
    </div>
  );
}
