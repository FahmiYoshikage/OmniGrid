import { requireSessionUser } from "@/lib/auth/access";
import { UptimeClient } from "./uptime-client";

export const runtime = "nodejs";

export default async function UptimePage() {
  await requireSessionUser();
  return <UptimeClient />;
}
