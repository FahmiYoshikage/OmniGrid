import { createHmac } from "node:crypto";
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { notificationsRepo, type NotificationChannelType } from "@/lib/db/repos/notifications";

export interface NotificationEvent {
  type: string; // e.g. "uptime.incident", "uptime.recovery", "node.down", "runbook.failure"
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical" | "resolved";
  details?: Record<string, unknown>;
}

export interface DispatchResult {
  channelId: string;
  channelName: string;
  type: NotificationChannelType;
  success: boolean;
  error?: string;
}

// ─── Provider Implementations ──────────────────────────────────────────────────

async function sendTelegram(config: Record<string, unknown>, event: NotificationEvent): Promise<{ statusCode: number }> {
  const botToken = String(config.botToken ?? "").trim();
  const chatId = String(config.chatId ?? "").trim();
  if (!botToken || !chatId) throw new Error("Telegram botToken and chatId are required");

  const emoji = event.severity === "resolved" ? "✅" : event.severity === "critical" ? "🚨" : "⚠️";
  let text = `${emoji} <b>[OmniGrid Alert] ${escapeHtml(event.title)}</b>\n\n${escapeHtml(event.message)}`;

  if (event.details) {
    text += "\n\n<b>Details:</b>";
    for (const [k, v] of Object.entries(event.details)) {
      text += `\n• <i>${escapeHtml(k)}</i>: <code>${escapeHtml(String(v))}</code>`;
    }
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Telegram API returned ${res.status}: ${errorBody}`);
  }

  return { statusCode: res.status };
}

async function sendDiscord(config: Record<string, unknown>, event: NotificationEvent): Promise<{ statusCode: number }> {
  const webhookUrl = String(config.webhookUrl ?? "").trim();
  if (!webhookUrl) throw new Error("Discord webhookUrl is required");

  const color = event.severity === "resolved"
    ? 0x10b981 // Green
    : event.severity === "critical"
      ? 0xef4444 // Red
      : 0xf59e0b; // Amber

  const fields = event.details
    ? Object.entries(event.details).map(([name, value]) => ({
        name,
        value: String(value),
        inline: true,
      }))
    : [];

  const body = {
    username: "OmniGrid Control Plane",
    avatar_url: "https://omnigrid.dev/logo.png",
    embeds: [
      {
        title: event.title,
        description: event.message,
        color,
        fields,
        footer: { text: "OmniGrid Zero Trust Telemetry" },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Discord Webhook returned ${res.status}: ${errorBody}`);
  }

  return { statusCode: res.status };
}

async function sendWebhook(config: Record<string, unknown>, event: NotificationEvent, workspaceId: string): Promise<{ statusCode: number }> {
  const url = String(config.url ?? "").trim();
  const secret = String(config.secret ?? "").trim();
  if (!url) throw new Error("Webhook url is required");

  const payload = {
    event: event.type,
    workspaceId,
    timestamp: Date.now(),
    data: {
      title: event.title,
      message: event.message,
      severity: event.severity ?? "info",
      details: event.details ?? {},
    },
  };

  const payloadString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OmniGrid-Dispatcher/1.0",
  };

  if (secret) {
    const sig = createHmac("sha256", secret).update(payloadString).digest("hex");
    headers["X-OmniGrid-Signature"] = `sha256=${sig}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: payloadString,
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Webhook target returned ${res.status}: ${errorBody}`);
  }

  return { statusCode: res.status };
}

async function sendEmail(config: Record<string, unknown>, event: NotificationEvent): Promise<{ statusCode: number }> {
  const to = String(config.to ?? config.email ?? "").trim();
  if (!to) throw new Error("Email recipient ('to') is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error(`Invalid email recipient address: '${to}'`);
  }

  let transporter: ReturnType<typeof nodemailer.createTransport>;
  let fromAddress: string;

  const smtpHost = String(config.smtpHost ?? "").trim();
  const smtpPort = Number(config.smtpPort ?? 0);
  const smtpUser = String(config.smtpUser ?? "").trim();
  const smtpPass = String(config.smtpPass ?? "").trim();
  const smtpSecure = Boolean(config.smtpSecure ?? (smtpPort === 465));

  if (smtpHost && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 587,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    fromAddress = String(config.from ?? smtpUser).trim();
  } else {
    const env = getEnv();
    if (!env.GMAIL_SMTP_USER || !env.GMAIL_SMTP_APP_PASSWORD) {
      throw new Error(
        "No SMTP credentials configured. Set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD in environment, or configure custom SMTP in channel."
      );
    }
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: env.GMAIL_SMTP_USER,
        pass: env.GMAIL_SMTP_APP_PASSWORD,
      },
    });
    fromAddress = env.AUTH_EMAIL_FROM?.trim() || env.GMAIL_SMTP_USER;
  }

  const prefix =
    event.severity === "resolved"
      ? "✅ [RESOLVED]"
      : event.severity === "critical"
        ? "🚨 [CRITICAL ALERT]"
        : "⚠️ [ALERT]";
  const subject = `${prefix} OmniGrid: ${event.title}`;

  let text = `OmniGrid Notification\n\nTitle: ${event.title}\nSeverity: ${event.severity ?? "info"}\nMessage: ${event.message}\n`;
  if (event.details) {
    text += "\nDetails:\n";
    for (const [k, v] of Object.entries(event.details)) {
      text += `  • ${k}: ${String(v)}\n`;
    }
  }
  text += `\nTimestamp: ${new Date().toISOString()}\n`;

  const color =
    event.severity === "resolved"
      ? "#10b981"
      : event.severity === "critical"
        ? "#ef4444"
        : "#f59e0b";

  const detailsHtml = event.details
    ? `
      <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:13px; font-family:monospace;">
        <tbody>
          ${Object.entries(event.details)
            .map(
              ([k, v]) => `
              <tr style="border-bottom:1px solid #1e293b;">
                <td style="padding:8px 0; color:#94a3b8;">${escapeHtml(k)}</td>
                <td style="padding:8px 0; color:#f1f5f9; text-align:right;">${escapeHtml(String(v))}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : "";

  const html = `
    <div style="font-family:Inter,Arial,sans-serif; background:#020617; color:#e2e8f0; padding:32px; border-radius:16px; max-width:600px; margin:0 auto;">
      <div style="border-bottom:1px solid #1e293b; padding-bottom:16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:22px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">OmniGrid</span>
        <span style="display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase; padding:4px 10px; border-radius:9999px; background:${color}22; color:${color}; border:1px solid ${color}44;">
          ${event.severity ?? "info"}
        </span>
      </div>
      <h2 style="font-size:18px; color:#ffffff; margin:0 0 12px 0;">${escapeHtml(event.title)}</h2>
      <p style="font-size:14px; line-height:1.6; color:#cbd5e1; margin:0 0 16px 0;">${escapeHtml(event.message)}</p>
      ${detailsHtml}
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #1e293b; font-size:11px; color:#64748b;">
        OmniGrid Zero Trust Telemetry &middot; ${new Date().toUTCString()}
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });

  return { statusCode: 200 };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

async function deliverToChannel(
  workspaceId: string,
  channel: { id: string; name: string; type: NotificationChannelType; config: Record<string, unknown> },
  event: NotificationEvent
): Promise<DispatchResult> {
  let success = false;
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    if (channel.type === "telegram") {
      const res = await sendTelegram(channel.config, event);
      statusCode = res.statusCode;
      success = true;
    } else if (channel.type === "discord") {
      const res = await sendDiscord(channel.config, event);
      statusCode = res.statusCode;
      success = true;
    } else if (channel.type === "webhook") {
      const res = await sendWebhook(channel.config, event, workspaceId);
      statusCode = res.statusCode;
      success = true;
    } else if (channel.type === "email") {
      const res = await sendEmail(channel.config, event);
      statusCode = res.statusCode;
      success = true;
    } else {
      errorMessage = `Channel type '${channel.type}' delivery not supported`;
    }
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  notificationsRepo.recordDelivery(workspaceId, {
    channelId: channel.id,
    eventType: event.type,
    payload: { ...event },
    status: success ? "delivered" : "failed",
    responseCode: statusCode,
    error: errorMessage,
    deliveredAt: success ? Date.now() : null,
  });

  return {
    channelId: channel.id,
    channelName: channel.name,
    type: channel.type,
    success,
    error: errorMessage ?? undefined,
  };
}

export async function dispatchNotification(
  workspaceId: string,
  event: NotificationEvent
): Promise<DispatchResult[]> {
  const channels = notificationsRepo.listEnabledForEvent(workspaceId, event.type);
  const results: DispatchResult[] = [];

  for (const channel of channels) {
    const res = await deliverToChannel(workspaceId, channel, event);
    results.push(res);
  }

  return results;
}

export async function dispatchToChannel(
  workspaceId: string,
  channelId: string,
  event: NotificationEvent
): Promise<DispatchResult> {
  const raw = notificationsRepo.getRaw(channelId, workspaceId);
  if (!raw) {
    throw new Error(`Notification channel '${channelId}' not found`);
  }
  return deliverToChannel(workspaceId, raw, event);
}
