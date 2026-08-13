import { PageHeader } from "@/components/app-shell";
import { requireSessionUser } from "@/lib/auth/access";
import { RunbooksClient } from "./runbooks-client";

export const dynamic = "force-dynamic";

export default async function RunbooksPage() {
  await requireSessionUser();

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Runbooks"
        description="Encrypted workspace library for repeatable operational commands, recovery notes, and shell procedures."
      />
      <RunbooksClient />
    </div>
  );
}
