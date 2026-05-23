/**
 * Subset of the Tailscale API device shape that we actually consume.
 * Source: https://tailscale.com/api#tag/devices
 */
export interface TailscaleDeviceRaw {
  id: string;
  nodeId: string;
  name: string;            // e.g. mybox.tail-scale.ts.net
  hostname: string;        // local hostname
  os: string;
  addresses: string[];     // tailnet IPs
  user: string;
  tags?: string[];
  lastSeen: string;        // ISO timestamp
  online?: boolean;
  authorized: boolean;
  isExternal: boolean;
  clientVersion?: string;
  updateAvailable?: boolean;
}

/** Normalised shape used everywhere downstream. */
export interface TailscaleDevice {
  id: string;
  name: string;
  shortName: string;
  hostname: string;
  os: string;
  tailscaleIp: string;
  addresses: string[];
  user: string;
  tags: string[];
  lastSeen: number;        // unix ms
  online: boolean;
  authorized: boolean;
  external: boolean;
  clientVersion: string | null;
  updateAvailable: boolean;
  localNodeId?: string;
  source?: "tailscale" | "local";
}

export interface TailnetSnapshot {
  devices: TailscaleDevice[];
  fetchedAt: number;
  source: "api";
}
