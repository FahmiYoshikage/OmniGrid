import { NextResponse } from "next/server";
import { deleteSession, getSessionUser } from "@/lib/auth/session";
import { protectMutation } from "@/lib/security/request";

/**
 * POST /api/auth/logout
 * Logs the user out by deleting the session.
 * Returns JSON with the user's display name for the logout animation.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  const securityResponse = protectMutation(request, "auth-logout", { userId: user?.id, limit: 10 });
  if (securityResponse) return securityResponse;
  const displayName = user?.displayName || user?.username || "";
  await deleteSession();
  return NextResponse.json({ ok: true, displayName });
}
