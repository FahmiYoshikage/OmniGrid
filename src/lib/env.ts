import { z } from "zod";

/**
 * Centralised, validated environment loader.
 * Fail-fast at boot: if any required var is missing/invalid we crash with a
 * readable error instead of producing weird runtime bugs deep in a request.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Crypto: 64-char hex string (32 bytes) used as AES-256-GCM master key.
  // Generate with:  openssl rand -hex 32
  OMNIGRID_MASTER_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "OMNIGRID_MASTER_KEY must be 64 hex chars (32 bytes)"),

  // SQLite database file path (relative or absolute).
  OMNIGRID_DB_PATH: z.string().default("./data/omnigrid.db"),

  // Server bind config (used by custom server later).
  OMNIGRID_HOST: z.string().default("0.0.0.0"),
  OMNIGRID_PORT: z.coerce.number().int().positive().default(3000),
  OMNIGRID_PUBLIC_URL: z.string().url().optional(),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GMAIL_SMTP_USER: z.string().email().optional(),
  GMAIL_SMTP_APP_PASSWORD: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
