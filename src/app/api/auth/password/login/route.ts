import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyUserCredentials } from "@/lib/auth/passwords";
import { createSession } from "@/lib/auth/session";
import { protectMutation, rateLimit } from "@/lib/security/request";

export const runtime = "nodejs";

const PasswordLoginSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  _gotcha: z.string().optional(), // Honeypot anti-spam
});

export async function POST(request: Request) {
  const securityResponse = protectMutation(request, "password-login");
  if (securityResponse) return securityResponse;

  const body = await request.json().catch(() => null);
  const parsed = PasswordLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid login credentials." },
      { status: 400 }
    );
  }

  // If bot touched honeypot, reject silently with generic error
  if (parsed.data._gotcha) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const cleanIdentifier = parsed.data.identifier.toLowerCase();

  // Rate limiting by identifier to protect against brute force attacks
  if (rateLimit(`login-attempt:${cleanIdentifier}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait 60 seconds." },
      { status: 429 }
    );
  }

  const user = verifyUserCredentials(parsed.data.identifier, parsed.data.password);
  if (!user) {
    return NextResponse.json(
      { error: "Incorrect username/email or password." },
      { status: 401 }
    );
  }

  await createSession(user.id);

  return NextResponse.json({
    ok: true,
    redirect: "/dashboard",
  });
}
