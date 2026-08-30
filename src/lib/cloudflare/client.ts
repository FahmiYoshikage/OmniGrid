import { integrationSettingsRepo } from "@/lib/db/repos/integration-settings";
import type {
  CloudflareOverview,
  CloudflarePublishedHostnameResult,
  CloudflareTunnelSummary,
  CloudflareZoneSummary,
} from "@/lib/cloudflare/types";

const API_BASE = "https://api.cloudflare.com/client/v4";

type TunnelIngressRule = {
  hostname?: string;
  service: string;
  originRequest?: Record<string, unknown>;
};

interface CloudflareEnvelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
  result_info?: {
    page?: number;
    per_page?: number;
    count?: number;
    total_count?: number;
    total_pages?: number;
  };
}

interface TunnelListItem {
  id: string;
  name: string;
  status?: string;
  conns_active_at?: string | null;
  created_at?: string;
}

interface TunnelConfigResponse {
  config?: {
    ingress?: TunnelIngressRule[];
  };
}

interface AccessApplicationItem {
  id: string;
  name: string;
  domain?: string;
  type?: string;
  session_duration?: string;
  created_at?: string;
  updated_at?: string;
}

interface ZoneItem {
  id: string;
  name: string;
  status?: string;
}

interface DnsRecordItem {
  id: string;
  zone_id: string;
  zone_name?: string;
  name: string;
  type: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
}

export interface CreatePublishedHostnameInput {
  tunnelId: string;
  hostname: string;
  service: string;
  path?: string;
}

function getWorkspaceCloudflare(workspaceId: string) {
  const settings = integrationSettingsRepo.revealCloudflare(workspaceId);
  if (!settings.accountId.trim()) {
    throw new Error("Cloudflare Account ID is not configured for this workspace.");
  }
  if (!settings.apiToken?.trim()) {
    throw new Error("Cloudflare API Token is not configured for this workspace.");
  }
  return {
    accountId: settings.accountId.trim(),
    apiToken: settings.apiToken.trim(),
  };
}

async function cfFetch<T>(workspaceId: string, path: string, init?: RequestInit): Promise<T> {
  const { accountId, apiToken } = getWorkspaceCloudflare(workspaceId);
  const resolvedPath = path.replaceAll(":accountId", accountId);
  const res = await fetch(`${API_BASE}${resolvedPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as CloudflareEnvelope<T> | null;

  if (!res.ok || !data?.success) {
    const msg = data?.errors?.map((e) => e.message).filter(Boolean).join("; ") || `Cloudflare API request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return data.result;
}

async function listTunnels(workspaceId: string): Promise<TunnelListItem[]> {
  return cfFetch<TunnelListItem[]>(workspaceId, "/accounts/:accountId/cfd_tunnel?is_deleted=false");
}

async function getTunnelConfig(workspaceId: string, tunnelId: string): Promise<TunnelConfigResponse> {
  return cfFetch<TunnelConfigResponse>(workspaceId, `/accounts/:accountId/cfd_tunnel/${tunnelId}/configurations`);
}

async function updateTunnelConfig(workspaceId: string, tunnelId: string, ingress: TunnelIngressRule[]) {
  return cfFetch<TunnelConfigResponse>(workspaceId, `/accounts/:accountId/cfd_tunnel/${tunnelId}/configurations`, {
    method: "PUT",
    body: JSON.stringify({ config: { ingress } }),
  });
}

async function listAccessApplications(workspaceId: string): Promise<AccessApplicationItem[]> {
  return cfFetch<AccessApplicationItem[]>(workspaceId, "/accounts/:accountId/access/apps");
}

async function listZones(workspaceId: string): Promise<ZoneItem[]> {
  return cfFetch<ZoneItem[]>(workspaceId, "/zones");
}

async function listZoneDnsRecords(workspaceId: string, zoneId: string): Promise<DnsRecordItem[]> {
  return cfFetch<DnsRecordItem[]>(workspaceId, `/zones/${zoneId}/dns_records?per_page=100&type=CNAME`);
}

async function createDnsRecord(workspaceId: string, zoneId: string, input: { name: string; content: string; proxied?: boolean }) {
  return cfFetch<DnsRecordItem>(workspaceId, `/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: "CNAME",
      name: input.name,
      content: input.content,
      proxied: input.proxied ?? true,
      ttl: 1,
    }),
  });
}

async function updateDnsRecord(workspaceId: string, zoneId: string, recordId: string, input: { name: string; content: string; proxied?: boolean }) {
  return cfFetch<DnsRecordItem>(workspaceId, `/zones/${zoneId}/dns_records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify({
      type: "CNAME",
      name: input.name,
      content: input.content,
      proxied: input.proxied ?? true,
      ttl: 1,
    }),
  });
}

function normalizeService(service: string, path?: string): string {
  const trimmedService = service.trim();
  if (!path?.trim()) return trimmedService;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedService}${normalizedPath}`;
}

function findZoneForHostname(hostname: string, zones: ZoneItem[]): ZoneItem | undefined {
  const normalized = hostname.toLowerCase();
  return [...zones]
    .sort((a, b) => b.name.length - a.name.length)
    .find((zone) => normalized === zone.name.toLowerCase() || normalized.endsWith(`.${zone.name.toLowerCase()}`));
}

async function ensureTunnelDnsRecord(workspaceId: string, tunnelId: string, hostname: string, zones: ZoneItem[]): Promise<CloudflarePublishedHostnameResult["dnsRecordStatus"]> {
  const zone = findZoneForHostname(hostname, zones);
  if (!zone) return "skipped";

  const desiredContent = `${tunnelId}.cfargotunnel.com`;
  const existingRecords = await listZoneDnsRecords(workspaceId, zone.id);
  const existing = existingRecords.find((record) => record.name.toLowerCase() === hostname.toLowerCase());

  if (!existing) {
    await createDnsRecord(workspaceId, zone.id, { name: hostname, content: desiredContent, proxied: true });
    return "created";
  }

  if (existing.content === desiredContent && existing.proxied) {
    return "existing";
  }

  await updateDnsRecord(workspaceId, zone.id, existing.id, { name: hostname, content: desiredContent, proxied: true });
  return "updated";
}

export async function getCloudflareOverview(workspaceId: string): Promise<CloudflareOverview> {
  const warnings: string[] = [];

  const tunnels = await listTunnels(workspaceId).catch((error) => {
    warnings.push(error instanceof Error ? `Tunnels: ${error.message}` : "Tunnels: failed to load");
    return [] as TunnelListItem[];
  });
  const accessApps = await listAccessApplications(workspaceId).catch((error) => {
    warnings.push(error instanceof Error ? `Access Apps: ${error.message}` : "Access Apps: failed to load");
    return [] as AccessApplicationItem[];
  });
  const zones = await listZones(workspaceId).catch((error) => {
    warnings.push(error instanceof Error ? `Zones: ${error.message}` : "Zones: failed to load");
    return [] as ZoneItem[];
  });

  const tunnelSummaries = await Promise.all(
    tunnels.map(async (tunnel) => {
      const config = await getTunnelConfig(workspaceId, tunnel.id).catch((error) => {
        warnings.push(error instanceof Error ? `Tunnel ${tunnel.name}: ${error.message}` : `Tunnel ${tunnel.name}: failed to load configuration`);
        return { config: { ingress: [] as TunnelIngressRule[] } };
      });
      const hostnames = (config.config?.ingress ?? [])
        .filter((rule) => Boolean(rule.hostname && rule.service))
        .map((rule) => ({
          hostname: rule.hostname!,
          service: rule.service,
        }));

      return {
        id: tunnel.id,
        name: tunnel.name,
        status: tunnel.status ?? "unknown",
        createdAt: tunnel.created_at ?? null,
        lastConnectedAt: tunnel.conns_active_at ?? null,
        hostnames,
      } satisfies CloudflareTunnelSummary;
    }),
  );

  const zoneSummaries = await Promise.all(
    zones.map(async (zone) => {
      const dnsRecords = await listZoneDnsRecords(workspaceId, zone.id).catch((error) => {
        warnings.push(error instanceof Error ? `DNS ${zone.name}: ${error.message}` : `DNS ${zone.name}: failed to load`);
        return [] as DnsRecordItem[];
      });
      return {
        id: zone.id,
        name: zone.name,
        status: zone.status ?? "unknown",
        dnsRecords: dnsRecords.map((record) => ({
          id: record.id,
          type: record.type,
          name: record.name,
          content: record.content,
          proxied: Boolean(record.proxied),
        })),
      } satisfies CloudflareZoneSummary;
    }),
  );

  return {
    tunnels: tunnelSummaries,
    accessApps: accessApps
      .filter((app) => Boolean(app.domain))
      .map((app) => ({
        id: app.id,
        name: app.name,
        domain: app.domain ?? "",
        type: app.type ?? "self_hosted",
        updatedAt: app.updated_at ?? app.created_at ?? null,
      })),
    zones: zoneSummaries,
    warnings,
  };
}

export async function createCloudflarePublishedHostname(workspaceId: string, input: CreatePublishedHostnameInput): Promise<CloudflarePublishedHostnameResult> {
  const config = await getTunnelConfig(workspaceId, input.tunnelId);
  const ingress = [...(config.config?.ingress ?? [])];
  const catchAll = ingress.find((rule) => !rule.hostname);
  const namedRules = ingress.filter((rule) => rule.hostname);
  const zones = await listZones(workspaceId).catch(() => [] as ZoneItem[]);

  const nextRule = {
    hostname: input.hostname.trim(),
    service: normalizeService(input.service, input.path),
  };

  const existingIndex = namedRules.findIndex((rule) => rule.hostname === nextRule.hostname);
  if (existingIndex >= 0) {
    namedRules[existingIndex] = nextRule;
  } else {
    namedRules.push(nextRule);
  }

  const nextIngress = catchAll ? [...namedRules, catchAll] : [...namedRules, { service: "http_status:404" }];
  const updated = await updateTunnelConfig(workspaceId, input.tunnelId, nextIngress);
  const dnsRecordStatus = await ensureTunnelDnsRecord(workspaceId, input.tunnelId, input.hostname.trim(), zones).catch(() => "skipped" as const);

  return {
    hostname: nextRule.hostname,
    service: nextRule.service,
    ingress: (updated.config?.ingress ?? nextIngress).map((rule) => ({
      hostname: rule.hostname,
      service: rule.service,
    })),
    dnsRecordStatus,
    dnsRecordName: nextRule.hostname,
  };
}
