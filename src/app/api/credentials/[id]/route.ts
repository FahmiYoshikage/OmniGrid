import { NextResponse } from "next/server";
import { z } from "zod";
import { credentialsRepo } from "@/lib/db/repos/credentials";

export const runtime = "nodejs";

const CredentialUpdateSchema = z.object({
  label: z.string().min(1).max(120),
  kind: z.enum(["ssh_key", "password"]),
  secret: z.string().optional(),
  passphrase: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const credential = credentialsRepo.get(id);
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ credential });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = CredentialUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const credential = credentialsRepo.update(id, parsed.data);
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ credential });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const credential = credentialsRepo.get(id);
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 });
  credentialsRepo.delete(id);
  return NextResponse.json({ ok: true });
}
