import { NextResponse } from "next/server";
import { z } from "zod";
import { completeInitialSetup, isSetupNeeded } from "@/lib/setup/status";
import { createSession } from "@/lib/auth/session";
import { protectMutation } from "@/lib/security/request";

export const runtime = "nodejs";

const SetupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username cannot exceed 32 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, hyphens, dots, and underscores"),
  displayName: z.string().trim().max(64).optional(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  email: z.string().trim().email("Please enter a valid email address").optional().or(z.literal("")),
  workspaceName: z.string().trim().max(64).optional(),
  tailscaleTailnet: z.string().trim().optional(),
  tailscaleApiKey: z.string().trim().optional(),
  cloudflareAccountId: z.string().trim().optional(),
  cloudflareTunnelToken: z.string().trim().optional(),
});

export async function POST(request: Request) {
  // Prevent any setup execution if setup is already completed
  if (!isSetupNeeded()) {
    return NextResponse.json(
      { error: "Initial system setup has already been completed." },
      { status: 403 }
    );
  }

  const securityResponse = protectMutation(request, "system-setup");
  if (securityResponse) return securityResponse;

  const body = await request.json().catch(() => null);
  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const { userId } = completeInitialSetup({
      username: parsed.data.username,
      displayName: parsed.data.displayName || undefined,
      password: parsed.data.password,
      email: parsed.data.email || undefined,
      workspaceName: parsed.data.workspaceName || undefined,
      tailscaleTailnet: parsed.data.tailscaleTailnet || undefined,
      tailscaleApiKey: parsed.data.tailscaleApiKey || undefined,
      cloudflareAccountId: parsed.data.cloudflareAccountId || undefined,
      cloudflareTunnelToken: parsed.data.cloudflareTunnelToken || undefined,
    });

    // Auto-login the newly initialized administrator
    await createSession(userId);

    return NextResponse.json({
      ok: true,
      redirect: "/dashboard",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Setup initialization failed" },
      { status: 400 }
    );
  }
}
