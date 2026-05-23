import { getSessionUser } from "@/lib/auth/session";
import { DashboardOverview } from "./dashboard-overview";
import { LandingPage } from "./landing-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <LandingPage />;
  return <DashboardOverview />;
}
