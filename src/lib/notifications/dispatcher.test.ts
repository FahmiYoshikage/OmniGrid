import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { notificationsRepo } from "@/lib/db/repos/notifications";
import { dispatchNotification, dispatchToChannel } from "./dispatcher";

function createWorkspace(label: string) {
  const db = getDb();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO users (id, github_id, username, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, Math.floor(Math.random() * 1_000_000_000), label, now, now);
  db.prepare("INSERT INTO workspaces (id, owner_id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(workspaceId, userId, label, `${label}-${workspaceId}`, now, now);
  return workspaceId;
}

beforeAll(() => {
  migrate();
});

afterAll(() => {
  getDb().prepare("DELETE FROM users").run();
});

describe("notifications and dispatcher", () => {
  it("creates, masks, and manages notification channels per workspace", () => {
    const ws = createWorkspace("notif-ws");

    const created = notificationsRepo.create(
      {
        name: "Dev Telegram",
        type: "telegram",
        config: { botToken: "123456789:ABCdefGhIJK", chatId: "-100987654" },
        events: ["uptime.incident"],
      },
      ws,
    );

    expect(created.name).toBe("Dev Telegram");
    expect(created.type).toBe("telegram");
    expect(created.configMasked.botToken).toContain("••••");
    expect(created.configMasked.chatId).toBe("-100987654");

    const channels = notificationsRepo.list(ws);
    expect(channels).toHaveLength(1);
    expect(channels[0]?.id).toBe(created.id);

    const updated = notificationsRepo.update(
      created.id,
      { enabled: false },
      ws,
    );
    expect(updated?.enabled).toBe(false);

    // Disabled channel should not be returned for events
    const enabled = notificationsRepo.listEnabledForEvent(ws, "uptime.incident");
    expect(enabled).toHaveLength(0);

    // Re-enable
    notificationsRepo.update(created.id, { enabled: true }, ws);
    const reEnabled = notificationsRepo.listEnabledForEvent(ws, "uptime.incident");
    expect(reEnabled).toHaveLength(1);
    expect(reEnabled[0]?.config.botToken).toBe("123456789:ABCdefGhIJK");
  });

  it("masks and validates email notification channels properly", () => {
    const ws = createWorkspace("notif-email-ws");

    const emailChannel = notificationsRepo.create(
      {
        name: "SRE Email Alerts",
        type: "email",
        config: {
          to: "sre-team@example.com",
          smtpHost: "smtp.mailgun.org",
          smtpUser: "postmaster@example.com",
          smtpPass: "secret-smtp-password-12345",
        },
        events: ["uptime.incident", "node.down"],
      },
      ws,
    );

    expect(emailChannel.type).toBe("email");
    expect(emailChannel.configMasked.to).toBe("sre-team@example.com");
    expect(emailChannel.configMasked.smtpPass).toContain("••••");
  });

  it("records delivery audit trail when dispatching notifications", async () => {
    const ws = createWorkspace("notif-audit-ws");

    const channel = notificationsRepo.create(
      {
        name: "Mock Webhook",
        type: "webhook",
        config: { url: "http://127.0.0.1:9999/non-existent-webhook", secret: "super-secret" },
        events: ["uptime.incident"],
      },
      ws,
    );

    // Dispatches notification (will record failed delivery because mock url is unreachable)
    const results = await dispatchNotification(ws, {
      type: "uptime.incident",
      title: "Target Down",
      message: "Server unreachable",
      severity: "critical",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.channelId).toBe(channel.id);
    expect(results[0]?.success).toBe(false);

    const deliveries = notificationsRepo.listDeliveries(ws);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.status).toBe("failed");
    expect(deliveries[0]?.eventType).toBe("uptime.incident");
    expect(deliveries[0]?.error).toBeDefined();
  });

  it("supports direct dispatchToChannel for testing or targeting", async () => {
    const ws = createWorkspace("notif-direct-ws");

    const channel = notificationsRepo.create(
      {
        name: "Test Direct Email",
        type: "email",
        config: {
          to: "invalid-recipient-without-domain",
        },
        events: ["uptime.incident"],
      },
      ws,
    );

    const result = await dispatchToChannel(ws, channel.id, {
      type: "test.alert",
      title: "Test Alert",
      message: "Direct alert verification",
      severity: "info",
    });

    expect(result.channelId).toBe(channel.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid email recipient address");
  });
});
