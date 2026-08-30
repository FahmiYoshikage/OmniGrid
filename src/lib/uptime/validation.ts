import { isIP } from "node:net";
import { promises as dns } from "node:dns";
import type { MonitorKind } from "@/lib/db/repos/uptime";

const UNSAFE_HOSTNAMES = new Set(["localhost", "localhost.", "metadata.google.internal"]);

function ipv4Number(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => part > 255)) return null;
  return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
}

function ipv6Bytes(value: string): number[] | null {
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if ([...left, ...right].some((part) => !/^[\da-f]{1,4}$/i.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  return [...left.map((part) => parseInt(part, 16)), ...Array(missing).fill(0), ...right.map((part) => parseInt(part, 16))]
    .flatMap((part) => [part >>> 8, part & 255]);
}

export function isPrivateOrLocalAddress(address: string): boolean {
  address = address.replace(/^\[|\]$/g, "");
  if (isIP(address) === 4) {
    const n = ipv4Number(address);
    if (n === null) return true;
    return n === 0 || (n >>> 24) === 10 || (n >>> 24) === 127 ||
      (n >>> 20) === 0xac1 || (n >>> 16) === 0xc0a8 || (n >>> 16) === 0xa9fe ||
      (n >>> 24) === 100 && (n >>> 26) === 25 || (n >>> 24) === 192 && (n >>> 16) === 0xc000 ||
      (n >>> 16) === 0xc612 || (n >>> 16) === 0xc633;
  }
  if (isIP(address) !== 6) return false;
  const bytes = ipv6Bytes(address);
  if (!bytes) return true;
  const unspecifiedOrLoopback = bytes.slice(0, 15).every((b) => b === 0);
  return unspecifiedOrLoopback || (bytes[0] & 0xfe) === 0xfc ||
    (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) ||
    bytes.slice(0, 12).every((b) => b === 0) || (bytes[0] === 0xff);
}

export function parseHttpUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid HTTP target"); }
  const hostname = url.hostname.toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || !hostname || url.username || url.password ||
    UNSAFE_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isPrivateOrLocalAddress(hostname)) {
    throw new Error("Unsafe or invalid HTTP target");
  }
  return url;
}

export function parseTcpTarget(value: string): { host: string; port: number } {
  const match = value.match(/^\[([^\]]+)\]:(\d{1,5})$|^([^:\s]+):(\d{1,5})$/);
  const host = match?.[1] ?? match?.[3];
  const port = Number(match?.[2] ?? match?.[4]);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid TCP target");
  return { host, port };
}

export async function resolveSafeHost(hostname: string): Promise<string> {
  hostname = hostname.replace(/^\[|\]$/g, "");
  if (!hostname || hostname.length > 253 || /[^a-zA-Z0-9.:-]/.test(hostname)) throw new Error("Invalid network target");
  if (UNSAFE_HOSTNAMES.has(hostname.toLowerCase()) || hostname.endsWith(".local")) throw new Error("Unsafe network target");
  if (isIP(hostname)) {
    if (isPrivateOrLocalAddress(hostname)) throw new Error("Unsafe network target");
    return hostname;
  }
  let addresses: Array<{ address: string }>;
  try { addresses = await dns.lookup(hostname, { all: true, verbatim: true }); } catch { throw new Error("Network target could not be resolved"); }
  if (!addresses.length || addresses.some(({ address }) => isPrivateOrLocalAddress(address))) throw new Error("Unsafe network target");
  return addresses[0].address;
}

export async function validateMonitorTarget(kind: MonitorKind, target: string): Promise<void> {
  if (kind === "http") { const url = parseHttpUrl(target); await resolveSafeHost(url.hostname); return; }
  if (kind === "tcp") { const { host } = parseTcpTarget(target); await resolveSafeHost(host); return; }
  if (!/^[a-zA-Z0-9.:-]{1,253}$/.test(target) || target.includes("..")) throw new Error("Invalid ping target");
  await resolveSafeHost(target);
}
