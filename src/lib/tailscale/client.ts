import { getEnv } from "@/lib/env";
import { integrationSettingsRepo } from "@/lib/db/repos/integration-settings";
import type {
  TailnetSnapshot,
  TailscaleDevice,
  TailscaleDeviceRaw,
} from "./types";

/**
 * Tailscale API client with a tiny TTL cache.
 *
 * Why a cache: the Tailnet rarely changes second-to-second, but the Topology
 * page may re-render or be opened in multiple tabs. Hitting the API every
 * render is wasteful and slow (200–600 ms RTT). 30 s TTL = snappy UI, fresh
 * enough for a dashboard.
 *
 * If TAILSCALE_API_KEY is absent we serve a deterministic mock so the app is
 * fully demo-able offline.
 */

const TTL_MS = 30_000;
const API_BASE = "https://api.tailscale.com/api/v2";

const cache = new Map<string, TailnetSnapshot>();
const inflight = new Map<string, Promise<TailnetSnapshot>>();

function shorten(name: string): string {
  // mybox.tail-1234.ts.net -> mybox
  return name.split(".")[0] || name;
}

function pickIpv4(addresses: string[]): string {
  return addresses.find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a)) ?? addresses[0] ?? "";
}

function normalise(raw: TailscaleDeviceRaw): TailscaleDevice {
  const lastSeen = Date.parse(raw.lastSeen) || 0;
  // Tailscale's `online` field exists on newer responses; fall back to
  // "seen in the last 5 minutes" heuristic.
  const online = raw.online ?? Date.now() - lastSeen < 5 * 60_000;
  return {
    id: raw.id,
    name: raw.name,
    shortName: shorten(raw.name),
    hostname: raw.hostname,
    os: raw.os,
    tailscaleIp: pickIpv4(raw.addresses),
    addresses: raw.addresses,
    user: raw.user,
    tags: raw.tags ?? [],
    lastSeen,
    online,
    authorized: raw.authorized,
    external: raw.isExternal,
    clientVersion: raw.clientVersion ?? null,
    updateAvailable: raw.updateAvailable ?? false,
  };
}

function mockSnapshot(): TailnetSnapshot {
  const now = Date.now();
  const fixtures: Array<Partial<TailscaleDeviceRaw> & { name: string; os: string }> = [
    { name: "homelab-pi.tail-demo.ts.net", os: "linux", hostname: "homelab-pi", addresses: ["100.64.0.10"] },
    { name: "vps-frankfurt.tail-demo.ts.net", os: "linux", hostname: "vps-frankfurt", addresses: ["100.64.0.20"] },
    { name: "nas-truenas.tail-demo.ts.net", os: "linux", hostname: "nas-truenas", addresses: ["100.64.0.30"] },
    { name: "macbook.tail-demo.ts.net", os: "macOS", hostname: "macbook", addresses: ["100.64.0.40"] },
    { name: "iphone.tail-demo.ts.net", os: "iOS", hostname: "iphone", addresses: ["100.64.0.50"], online: false },
  ];
  const devices = fixtures.map((f, i) =>
    normalise({
      id: `mock-${i}`,
      nodeId: `mock-node-${i}`,
      name: f.name,
      hostname: f.hostname ?? f.name,
      os: f.os,
      addresses: f.addresses ?? [`100.64.0.${100 + i}`],
      user: "demo@example.com",
      tags: i === 0 ? ["tag:server"] : [],
      lastSeen: new Date(now - (f.online === false ? 3_600_000 : 30_000)).toISOString(),
      online: f.online ?? true,
      authorized: true,
      isExternal: false,
      clientVersion: "1.84.0",
      updateAvailable: false,
    } as TailscaleDeviceRaw),
  );
  return { devices, fetchedAt: now, source: "mock" };
}

async function fetchFromApi(workspaceId?: string): Promise<TailnetSnapshot> {
  const env = getEnv();
  const settings = workspaceId ? integrationSettingsRepo.revealTailscale(workspaceId) : null;
  const apiKey = settings?.apiKey || env.TAILSCALE_API_KEY;
  const tailnet = settings?.tailnet || env.TAILSCALE_TAILNET;
  if (!apiKey || !tailnet) {
    return mockSnapshot();
  }
  const url = `${API_BASE}/tailnet/${encodeURIComponent(tailnet)}/devices`;
  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    // Next.js extends fetch; disable per-request cache, we manage our own.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Tailscale API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { devices: TailscaleDeviceRaw[] };
  return {
    devices: json.devices.map(normalise),
    fetchedAt: Date.now(),
    source: "api",
  };
}

export async function getTailnet(opts?: { force?: boolean; workspaceId?: string }): Promise<TailnetSnapshot> {
  const cacheKey = opts?.workspaceId ?? "default";
  const cached = cache.get(cacheKey);
  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
  if (fresh && !opts?.force) return cached;
  const existingInflight = inflight.get(cacheKey);
  if (existingInflight) return existingInflight;
  const promise = (async () => {
    try {
      const snap = await fetchFromApi(opts?.workspaceId);
      cache.set(cacheKey, snap);
      return snap;
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, promise);
  return promise;
}

export function clearTailnetCache(workspaceId?: string): void {
  if (workspaceId) {
    cache.delete(workspaceId);
    return;
  }
  cache.clear();
}
