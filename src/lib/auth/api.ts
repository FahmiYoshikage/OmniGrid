import { NextResponse } from "next/server";
import { getSessionUser } from "./session";
import { hasPermission, type Permission } from "./permissions";

export async function requireApiSession() {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, response: null };
}

export async function requireApiPermission(permission: Permission) {
  const result = await requireApiSession();
  if (result.response || !result.user) return result;
  if (!hasPermission(result.user, permission)) {
    return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}
