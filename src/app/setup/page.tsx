import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSetupNeeded, getPreflightChecks } from "@/lib/setup/status";
import { SetupWizard } from "./setup-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "First-Time System Setup",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SetupPage() {
  const needed = isSetupNeeded();
  if (!needed) {
    redirect("/login");
  }

  const preflight = getPreflightChecks();

  return <SetupWizard preflight={preflight} />;
}
