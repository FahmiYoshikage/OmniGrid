import { NextResponse } from "next/server";
import { z } from "zod";
import { credentialsRepo } from "@/lib/db/repos/credentials";
import { requireApiSession } from "@/lib/auth/api";

export const runtime = "nodejs";

const CredentialInputSchema = z.object({
  label: z.string().min(1).max(120),
  kind: z.enum(["ssh_key", "password"]),
  secret: z.string().min(1),
  passphrase: z.string().optional(),
});

export async function GET() {
  const { user, response } = await requireApiSession();
  if (response) return response;
  return NextResponse.json({ credentials: credentialsRepo.list(user.workspaceId) });
}

export async function POST(req: Request) {
  const { user, response } = await requireApiSession();
  if (response) return response;
  const body = await req.json().catch(() => null);
  const parsed = CredentialInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const credential = credentialsRepo.create(parsed.data, user.workspaceId);
    return NextResponse.json({ credential }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
