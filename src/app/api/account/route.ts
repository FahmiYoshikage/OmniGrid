import { NextResponse } from "next/server";
import { deleteSession, getSessionUser } from "@/lib/auth/session";
import { deleteUserAccount, updateUserProfile } from "@/lib/auth/accounts";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      workspaceId: user.workspaceId,
    },
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const securityResponse = protectMutation(request, "account", { userId: user.id });
  if (securityResponse) return securityResponse;

  const body = (await request.json().catch(() => null)) as
    | { username?: unknown; displayName?: unknown; avatarUrl?: unknown }
    | null;

  if (!body || typeof body.username !== "string") {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  try {
    const updated = updateUserProfile(user.id, {
      username: body.username,
      displayName: typeof body.displayName === "string" ? body.displayName : null,
      avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : null,
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        displayName: updated.display_name,
        email: updated.email,
        avatarUrl: updated.avatar_url,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update account." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const securityResponse = protectMutation(request, "account", { userId: user.id, limit: 5 });
  if (securityResponse) return securityResponse;

  deleteUserAccount(user.id);
  await deleteSession();

  return NextResponse.json({ ok: true });
}
