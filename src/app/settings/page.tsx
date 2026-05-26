import { PageHeader } from "@/components/app-shell";
import { getAuthAvailability } from "@/lib/auth/availability";
import { requireSessionUser } from "@/lib/auth/access";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireSessionUser();
  const authAvailability = getAuthAvailability();
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Settings"
        description="Manage your workspace integrations — Tailscale, Cloudflare Zero Trust, and more."
      />
      <SettingsClient sessionEmail={user.email ?? ""} initialAuthAvailability={authAvailability} />
    </div>
  );
}
