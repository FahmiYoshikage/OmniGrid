import { getSessionUser } from "@/lib/auth/session";
import { LandingPage } from "./landing-page";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <LandingPage />;
  redirect("/dashboard");
}
