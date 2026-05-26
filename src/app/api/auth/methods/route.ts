import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { getAuthAvailability } from "@/lib/auth/availability";
import { listAuthMethods } from "@/lib/auth/accounts";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireApiSession();
  if (response) return response;

  return NextResponse.json({
    methods: listAuthMethods(user.id),
    availability: getAuthAvailability(),
  });
}
