import { randomUUID } from "node:crypto";
import { prep } from "@/lib/db/client";
import { decrypt, encrypt } from "@/lib/crypto";

export type IntegrationProvider = "tailscale" | "cloudflare" | "webhook";

interface IntegrationSettingRow {
  id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  key: string;
  value_enc: string;
  created_at: number;
  updated_at: number;
}

export interface TailscaleSettingsPublic {
  tailnet: string;
  hasApiKey: boolean;
  updatedAt: number | null;
}

export interface TailscaleSettingsSecret extends TailscaleSettingsPublic {
  apiKey: string | null;
}

export interface CloudflareSettingsPublic {
  accountId: string;
  hasTunnelToken: boolean;
  hasApiToken: boolean;
  updatedAt: number | null;
}

export interface CloudflareSettingsSecret extends CloudflareSettingsPublic {
  tunnelToken: string | null;
  apiToken: string | null;
}

function getSetting(workspaceId: string, provider: IntegrationProvider, key: string): IntegrationSettingRow | undefined {
  return prep<[string, IntegrationProvider, string]>(
    "SELECT * FROM integration_settings WHERE workspace_id = ? AND provider = ? AND key = ?",
  ).get(workspaceId, provider, key) as IntegrationSettingRow | undefined;
}

function setSetting(workspaceId: string, provider: IntegrationProvider, key: string, value: string): void {
  const existing = getSetting(workspaceId, provider, key);
  const now = Date.now();
  if (existing) {
    prep<[string, number, string]>("UPDATE integration_settings SET value_enc = ?, updated_at = ? WHERE id = ?").run(
      encrypt(value),
      now,
      existing.id,
    );
    return;
  }
  prep<[string, string, IntegrationProvider, string, string, number, number]>(
    "INSERT INTO integration_settings (id, workspace_id, provider, key, value_enc, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(randomUUID(), workspaceId, provider, key, encrypt(value), now, now);
}

function deleteSetting(workspaceId: string, provider: IntegrationProvider, key: string): void {
  prep<[string, IntegrationProvider, string]>(
    "DELETE FROM integration_settings WHERE workspace_id = ? AND provider = ? AND key = ?",
  ).run(workspaceId, provider, key);
}

function revealSetting(workspaceId: string, provider: IntegrationProvider, key: string): string | null {
  const row = getSetting(workspaceId, provider, key);
  return row ? decrypt(row.value_enc) : null;
}

export const integrationSettingsRepo = {
  // ─── Tailscale ──────────────────────────────────────────────────────────────
  getTailscalePublic(workspaceId: string): TailscaleSettingsPublic {
    const apiKey = getSetting(workspaceId, "tailscale", "api_key");
    const tailnet = getSetting(workspaceId, "tailscale", "tailnet");
    return {
      tailnet: tailnet ? decrypt(tailnet.value_enc) : "",
      hasApiKey: Boolean(apiKey),
      updatedAt: Math.max(apiKey?.updated_at ?? 0, tailnet?.updated_at ?? 0) || null,
    };
  },

  revealTailscale(workspaceId: string): TailscaleSettingsSecret {
    const publicSettings = this.getTailscalePublic(workspaceId);
    return {
      ...publicSettings,
      apiKey: revealSetting(workspaceId, "tailscale", "api_key"),
    };
  },

  updateTailscale(workspaceId: string, input: { tailnet: string; apiKey?: string; clearApiKey?: boolean }): TailscaleSettingsPublic {
    setSetting(workspaceId, "tailscale", "tailnet", input.tailnet.trim());
    if (input.clearApiKey) {
      deleteSetting(workspaceId, "tailscale", "api_key");
    } else if (input.apiKey?.trim()) {
      setSetting(workspaceId, "tailscale", "api_key", input.apiKey.trim());
    }
    return this.getTailscalePublic(workspaceId);
  },

  // ─── Cloudflare Zero Trust ──────────────────────────────────────────────────
  getCloudflarePublic(workspaceId: string): CloudflareSettingsPublic {
    const accountId = getSetting(workspaceId, "cloudflare", "account_id");
    const tunnelToken = getSetting(workspaceId, "cloudflare", "tunnel_token");
    const apiToken = getSetting(workspaceId, "cloudflare", "api_token");
    return {
      accountId: accountId ? decrypt(accountId.value_enc) : "",
      hasTunnelToken: Boolean(tunnelToken),
      hasApiToken: Boolean(apiToken),
      updatedAt: Math.max(accountId?.updated_at ?? 0, tunnelToken?.updated_at ?? 0, apiToken?.updated_at ?? 0) || null,
    };
  },

  revealCloudflare(workspaceId: string): CloudflareSettingsSecret {
    const publicSettings = this.getCloudflarePublic(workspaceId);
    return {
      ...publicSettings,
      tunnelToken: revealSetting(workspaceId, "cloudflare", "tunnel_token"),
      apiToken: revealSetting(workspaceId, "cloudflare", "api_token"),
    };
  },

  updateCloudflare(workspaceId: string, input: {
    accountId: string;
    tunnelToken?: string;
    apiToken?: string;
    clearTunnelToken?: boolean;
    clearApiToken?: boolean;
  }): CloudflareSettingsPublic {
    setSetting(workspaceId, "cloudflare", "account_id", input.accountId.trim());
    if (input.clearTunnelToken) {
      deleteSetting(workspaceId, "cloudflare", "tunnel_token");
    } else if (input.tunnelToken?.trim()) {
      setSetting(workspaceId, "cloudflare", "tunnel_token", input.tunnelToken.trim());
    }
    if (input.clearApiToken) {
      deleteSetting(workspaceId, "cloudflare", "api_token");
    } else if (input.apiToken?.trim()) {
      setSetting(workspaceId, "cloudflare", "api_token", input.apiToken.trim());
    }
    return this.getCloudflarePublic(workspaceId);
  },
};
