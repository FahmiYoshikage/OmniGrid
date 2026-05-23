import { NextResponse } from "next/server";
import { deleteSession, getSessionUser } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 * Logs the user out by deleting the session.
 * Returns JSON with the user's display name for the logout animation.
 */
export async function POST() {
  const user = await getSessionUser();
  const displayName = user?.displayName || user?.username || "";
  await deleteSession();
  return NextResponse.json({ ok: true, displayName });
}
