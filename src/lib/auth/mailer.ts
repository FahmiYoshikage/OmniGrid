import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const env = getEnv();
  if (!env.GMAIL_SMTP_USER || !env.GMAIL_SMTP_APP_PASSWORD) {
    throw new Error("Missing GMAIL_SMTP_USER or GMAIL_SMTP_APP_PASSWORD environment variables.");
  }

  cachedTransport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: env.GMAIL_SMTP_USER,
      pass: env.GMAIL_SMTP_APP_PASSWORD,
    },
  });

  return cachedTransport;
}

export async function sendMagicLinkEmail(input: {
  to: string;
  linkUrl: string;
  expiresAt: number;
  mode: "login" | "link";
}) {
  const env = getEnv();
  const from = env.AUTH_EMAIL_FROM?.trim() || env.GMAIL_SMTP_USER;
  if (!from) {
    throw new Error("Missing AUTH_EMAIL_FROM or GMAIL_SMTP_USER environment variables.");
  }

  const transport = getTransport();
  const expiresAtText = new Date(input.expiresAt).toLocaleString();
  const action = input.mode === "link" ? "link this email to your OmniGrid account" : "sign in to OmniGrid";
  const subject = input.mode === "link" ? "Link your email to OmniGrid" : "Your OmniGrid sign-in link";

  await transport.sendMail({
    from,
    to: input.to,
    subject,
    text: `Use this secure link to ${action}: ${input.linkUrl}\n\nThis link expires at ${expiresAtText}. If you did not request it, you can ignore this email.`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#020617; color:#e2e8f0; padding:32px; border-radius:24px;">
        <div style="max-width:560px; margin:0 auto;">
          <div style="font-size:28px; font-weight:700; color:#ffffff; margin-bottom:12px;">OmniGrid</div>
          <p style="font-size:15px; line-height:1.7; color:#cbd5e1;">Use the secure link below to ${action}.</p>
          <div style="margin:24px 0;">
            <a href="${input.linkUrl}" style="display:inline-block; background:linear-gradient(135deg,#22d3ee,#34d399); color:#0f172a; text-decoration:none; font-weight:700; padding:14px 22px; border-radius:16px;">Open OmniGrid</a>
          </div>
          <p style="font-size:13px; line-height:1.7; color:#94a3b8; word-break:break-all;">If the button does not work, open this URL:<br/>${input.linkUrl}</p>
          <p style="font-size:13px; line-height:1.7; color:#94a3b8;">This link expires at ${expiresAtText}. If you did not request it, you can ignore this email.</p>
        </div>
      </div>
    `,
  });
}
