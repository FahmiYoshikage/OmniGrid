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
        description="Manage your account, login methods, and workspace integrations."
      />
      <SettingsClient
        initialUser={{
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
        sessionEmail={user.email ?? ""}
        initialAuthAvailability={authAvailability}
      />
    </div>
  );
}
