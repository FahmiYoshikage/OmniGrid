import { randomUUID } from "node:crypto";
import { decrypt, encrypt } from "@/lib/crypto";
import { prep } from "@/lib/db/client";

export type NotificationChannelType = "telegram" | "discord" | "email" | "webhook";
export type NotificationDeliveryStatus = "pending" | "delivered" | "failed";

export interface NotificationChannelRow {
  id: string;
  workspace_id: string;
  name: string;
  type: NotificationChannelType;
  enabled: number;
  config_enc: string;
  events_json: string;
  created_at: number;
  updated_at: number;
}

export interface NotificationChannelSummary {
  id: string;
  name: string;
  type: NotificationChannelType;
  enabled: boolean;
  events: string[];
  configMasked: Record<string, string>;
  created_at: number;
  updated_at: number;
}

export interface NotificationChannelInput {
  name: string;
  type: NotificationChannelType;
  enabled?: boolean;
  events?: string[];
  config: Record<string, unknown>;
}

export interface NotificationDeliveryRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  event_type: string;
  payload_json: string;
  status: NotificationDeliveryStatus;
  response_code: number | null;
  error: string | null;
  created_at: number;
  delivered_at: number | null;
}

export interface NotificationDeliverySummary {
  id: string;
  channelId: string;
  channelName?: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: NotificationDeliveryStatus;
  responseCode: number | null;
  error: string | null;
  createdAt: number;
  deliveredAt: number | null;
}

function maskConfig(type: NotificationChannelType, config: Record<string, unknown>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    const str = String(value ?? "");
    if (key === "chatId" || key === "to") {
      masked[key] = str;
    } else if (str.length > 8) {
      masked[key] = `${str.slice(0, 4)}••••${str.slice(-4)}`;
    } else {
      masked[key] = "••••••••";
    }
  }
  return masked;
}

function toSummary(row: NotificationChannelRow): NotificationChannelSummary {
  let events: string[] = [];
  try {
    events = JSON.parse(row.events_json);
  } catch {
    events = ["uptime.incident"];
  }

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(decrypt(row.config_enc));
  } catch {
    config = {};
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    enabled: Boolean(row.enabled),
    events,
    configMasked: maskConfig(row.type, config),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const notificationsRepo = {
  list(workspaceId: string): NotificationChannelSummary[] {
    const rows = prep<[string]>(
      "SELECT * FROM notification_channels WHERE workspace_id = ? ORDER BY created_at DESC"
    ).all(workspaceId) as NotificationChannelRow[];
    return rows.map(toSummary);
  },

  listEnabledForEvent(workspaceId: string, eventType: string): Array<{ id: string; name: string; type: NotificationChannelType; config: Record<string, unknown> }> {
    const rows = prep<[string]>(
      "SELECT * FROM notification_channels WHERE workspace_id = ? AND enabled = 1"
    ).all(workspaceId) as NotificationChannelRow[];

    return rows
      .filter((row) => {
        try {
          const events: string[] = JSON.parse(row.events_json);
          return events.includes(eventType) || events.includes("*");
        } catch {
          return false;
        }
      })
      .map((row) => {
        try {
          const config = JSON.parse(decrypt(row.config_enc)) as Record<string, unknown>;
          return { id: row.id, name: row.name, type: row.type, config };
        } catch {
          return null;
        }
      })
      .filter((c): c is { id: string; name: string; type: NotificationChannelType; config: Record<string, unknown> } => c !== null);
  },

  get(id: string, workspaceId: string): NotificationChannelSummary | undefined {
    const row = prep<[string, string]>(
      "SELECT * FROM notification_channels WHERE id = ? AND workspace_id = ?"
    ).get(id, workspaceId) as NotificationChannelRow | undefined;
    return row ? toSummary(row) : undefined;
  },

  getRaw(id: string, workspaceId: string): { id: string; name: string; type: NotificationChannelType; config: Record<string, unknown> } | undefined {
    const row = prep<[string, string]>(
      "SELECT * FROM notification_channels WHERE id = ? AND workspace_id = ?"
    ).get(id, workspaceId) as NotificationChannelRow | undefined;
    if (!row) return undefined;
    try {
      const config = JSON.parse(decrypt(row.config_enc)) as Record<string, unknown>;
      return { id: row.id, name: row.name, type: row.type, config };
    } catch {
      return undefined;
    }
  },

  create(input: NotificationChannelInput, workspaceId: string): NotificationChannelSummary {
    const id = randomUUID();
    const now = Date.now();
    const eventsJson = JSON.stringify(input.events ?? ["uptime.incident", "node.down", "runbook.failure"]);
    const configEnc = encrypt(JSON.stringify(input.config));

    prep<[string, string, string, string, number, string, string, number, number]>(
      `INSERT INTO notification_channels (id, workspace_id, name, type, enabled, config_enc, events_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      workspaceId,
      input.name.trim(),
      input.type,
      input.enabled === false ? 0 : 1,
      configEnc,
      eventsJson,
      now,
      now,
    );

    return toSummary(
      prep<[string, string]>(
        "SELECT * FROM notification_channels WHERE id = ? AND workspace_id = ?"
      ).get(id, workspaceId) as NotificationChannelRow
    );
  },

  update(id: string, input: Partial<NotificationChannelInput>, workspaceId: string): NotificationChannelSummary | undefined {
    const existing = prep<[string, string]>(
      "SELECT * FROM notification_channels WHERE id = ? AND workspace_id = ?"
    ).get(id, workspaceId) as NotificationChannelRow | undefined;
    if (!existing) return undefined;

    const name = input.name?.trim() || existing.name;
    const type = input.type || existing.type;
    const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled;
    const eventsJson = input.events ? JSON.stringify(input.events) : existing.events_json;
    const configEnc = input.config ? encrypt(JSON.stringify(input.config)) : existing.config_enc;
    const now = Date.now();

    prep<[string, string, number, string, string, number, string, string]>(
      `UPDATE notification_channels
       SET name = ?, type = ?, enabled = ?, events_json = ?, config_enc = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`
    ).run(
      name,
      type,
      enabled,
      eventsJson,
      configEnc,
      now,
      id,
      workspaceId,
    );

    return toSummary(
      prep<[string, string]>(
        "SELECT * FROM notification_channels WHERE id = ? AND workspace_id = ?"
      ).get(id, workspaceId) as NotificationChannelRow
    );
  },

  delete(id: string, workspaceId: string): boolean {
    const res = prep<[string, string]>(
      "DELETE FROM notification_channels WHERE id = ? AND workspace_id = ?"
    ).run(id, workspaceId);
    return res.changes > 0;
  },

  // ─── Deliveries ────────────────────────────────────────────────────────────

  recordDelivery(
    workspaceId: string,
    input: {
      channelId: string;
      eventType: string;
      payload: Record<string, unknown>;
      status: NotificationDeliveryStatus;
      responseCode?: number | null;
      error?: string | null;
      deliveredAt?: number | null;
    }
  ): string {
    const id = randomUUID();
    const now = Date.now();

    prep<[string, string, string, string, string, string, number | null, string | null, number, number | null]>(
      `INSERT INTO notification_deliveries (id, workspace_id, channel_id, event_type, payload_json, status, response_code, error, created_at, delivered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      workspaceId,
      input.channelId,
      input.eventType,
      JSON.stringify(input.payload),
      input.status,
      input.responseCode ?? null,
      input.error ?? null,
      now,
      input.deliveredAt ?? null,
    );

    return id;
  },

  listDeliveries(workspaceId: string, limit = 50): NotificationDeliverySummary[] {
    const rows = prep<[string, number]>(
      `SELECT d.*, c.name AS channel_name
       FROM notification_deliveries d
       LEFT JOIN notification_channels c ON c.id = d.channel_id
       WHERE d.workspace_id = ?
       ORDER BY d.created_at DESC LIMIT ?`
    ).all(workspaceId, Math.min(Math.max(limit, 1), 100)) as Array<NotificationDeliveryRow & { channel_name?: string }>;

    return rows.map((r) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(r.payload_json);
      } catch {
        payload = {};
      }
      return {
        id: r.id,
        channelId: r.channel_id,
        channelName: r.channel_name,
        eventType: r.event_type,
        payload,
        status: r.status,
        responseCode: r.response_code,
        error: r.error,
        createdAt: r.created_at,
        deliveredAt: r.delivered_at,
      };
    });
  },
};
