export interface CloudflareTunnelHostnameSummary {
  hostname: string;
  service: string;
}

export interface CloudflareTunnelSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string | null;
  lastConnectedAt: string | null;
  hostnames: CloudflareTunnelHostnameSummary[];
}

export interface CloudflareAccessAppSummary {
  id: string;
  name: string;
  domain: string;
  type: string;
  updatedAt: string | null;
}

export interface CloudflareZoneDnsRecordSummary {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

export interface CloudflareZoneSummary {
  id: string;
  name: string;
  status: string;
  dnsRecords: CloudflareZoneDnsRecordSummary[];
}

export interface CloudflareOverview {
  tunnels: CloudflareTunnelSummary[];
  accessApps: CloudflareAccessAppSummary[];
  zones: CloudflareZoneSummary[];
  warnings: string[];
}

export interface CloudflarePublishedHostnameResult {
  hostname: string;
  service: string;
  ingress: Array<{
    hostname?: string;
    service: string;
  }>;
  dnsRecordStatus: "created" | "updated" | "existing" | "skipped";
  dnsRecordName: string | null;
}
