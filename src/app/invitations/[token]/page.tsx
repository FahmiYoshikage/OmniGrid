import type { Metadata } from "next";
import { InvitationAcceptance } from "./invitation-acceptance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace invitation",
  robots: { index: false, follow: false },
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitationAcceptance token={token} />;
}
