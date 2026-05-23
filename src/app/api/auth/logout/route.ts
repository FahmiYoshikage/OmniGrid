import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 * Logs the user out by deleting the session.
 */
export async function POST(request: NextRequest) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
