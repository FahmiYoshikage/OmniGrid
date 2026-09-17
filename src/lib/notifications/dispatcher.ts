import { createHmac } from "node:crypto";
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

export async function dispatchNotification(
  workspaceId: string,
  event: NotificationEvent
): Promise<DispatchResult[]> {
  const channels = notificationsRepo.listEnabledForEvent(workspaceId, event.type);
  const results: DispatchResult[] = [];

  for (const channel of channels) {
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
      } else {
        errorMessage = `Channel type '${channel.type}' delivery not yet configured`;
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

    results.push({
      channelId: channel.id,
      channelName: channel.name,
      type: channel.type,
      success,
      error: errorMessage ?? undefined,
    });
  }

  return results;
}
