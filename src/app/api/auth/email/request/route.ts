import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { createEmailLoginToken } from "@/lib/auth/accounts";
import { sendMagicLinkEmail } from "@/lib/auth/mailer";
import { protectMutation, protectRateLimit } from "@/lib/security/request";

export const runtime = "nodejs";

const EmailRequestSchema = z.object({
  email: z.string().trim().email(),
  intent: z.enum(["login", "link"]).optional(),
});

export async function POST(req: Request) {
  const rateResponse = protectRateLimit(req, "auth-email-request", { limit: 5, windowMs: 10 * 60_000 });
  if (rateResponse) return rateResponse;
  const securityResponse = protectMutation(req, "auth-email-request-origin", { limit: 5, windowMs: 10 * 60_000 });
  if (securityResponse) return securityResponse;
  const body = await req.json().catch(() => null);
  const parsed = EmailRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const intent = parsed.data.intent ?? "login";
  const sessionUser = await getSessionUser();
  if (intent === "link" && !sessionUser) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  try {
    const token = createEmailLoginToken({
      email: parsed.data.email,
      linkUserId: intent === "link" ? sessionUser?.id ?? null : null,
    });

    await sendMagicLinkEmail({
      to: token.email,
      linkUrl: token.linkUrl,
      expiresAt: token.expiresAt,
      mode: intent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send magic link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
