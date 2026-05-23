import { PageHeader } from "@/components/app-shell";
import { requireSessionUser } from "@/lib/auth/access";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSessionUser();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Settings"
        description="Manage your workspace integrations — Tailscale, Cloudflare Zero Trust, and more."
      />
      <SettingsClient />
    </div>
  );
}
