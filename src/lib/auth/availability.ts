import { getEnv } from "@/lib/env";

export interface AuthAvailability {
  github: boolean;
  google: boolean;
  email: boolean;
}

export function getAuthAvailability(): AuthAvailability {
  const env = getEnv();
  return {
    github: Boolean(env.OMNIGRID_PUBLIC_URL && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    google: Boolean(env.OMNIGRID_PUBLIC_URL && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    email: Boolean(env.OMNIGRID_PUBLIC_URL && env.GMAIL_SMTP_USER && env.GMAIL_SMTP_APP_PASSWORD),
  };
}
