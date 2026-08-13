import { DashboardOverview } from "@/app/dashboard-overview";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const params = await searchParams;
  return <DashboardOverview showOnboarding={params.welcome === "1"} />;
}
