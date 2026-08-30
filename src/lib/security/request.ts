import "server-only";

import { NextResponse } from "next/server";

const DEFAULT_BODY_LIMIT = 256 * 1024;
const MAX_BUCKETS = 10_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function expectedOrigin(request: Request): string | null {
  const configured = process.env.OMNIGRID_PUBLIC_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return null;
    }
  }
  return new URL(request.url).origin;
}

export function validateMutationOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin || origin !== expectedOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  return null;
}

export function validateJsonRequest(
  request: Request,
  maxBytes = DEFAULT_BODY_LIMIT,
): NextResponse | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const sizeError = bodySizeError(request, maxBytes);
  if (sizeError) return sizeError;
  return null;
}

export function bodySizeError(request: Request, maxBytes = DEFAULT_BODY_LIMIT): NextResponse | null {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }
  return null;
}

export async function readJsonBody<T = unknown>(
  request: Request,
  maxBytes = DEFAULT_BODY_LIMIT,
): Promise<{ value: T | null; response: NextResponse | null }> {
  const contentError = validateJsonRequest(request, maxBytes);
  if (contentError) return { value: null, response: contentError };
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) {
    return { value: null, response: NextResponse.json({ error: "Request body too large" }, { status: 413 }) };
  }
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)) as T, response: null };
  } catch {
    return { value: null, response: null };
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
        if (buckets.size < MAX_BUCKETS) break;
      }
      if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return null;
}

export function rateLimitResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export function requestRateLimitKey(request: Request, scope: string, userId?: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim();
  return `${scope}:${userId ?? forwarded ?? request.headers.get("x-real-ip") ?? "unknown"}`;
}

export function protectMutation(
  request: Request,
  scope: string,
  options: { userId?: string; limit?: number; windowMs?: number; maxBytes?: number } = {},
): NextResponse | null {
  const originError = validateMutationOrigin(request);
  if (originError) return originError;
  if (request.method !== "DELETE" && request.method !== "GET" && request.method !== "HEAD") {
    const bodyError = validateJsonRequest(request, options.maxBytes);
    if (bodyError) return bodyError;
  }
  const retryAfter = rateLimit(
    requestRateLimitKey(request, scope, options.userId),
    options.limit ?? 30,
    options.windowMs ?? 60_000,
  );
  return retryAfter ? rateLimitResponse(retryAfter) : null;
}

export function protectRateLimit(
  request: Request,
  scope: string,
  options: { limit?: number; windowMs?: number } = {},
): NextResponse | null {
  const retryAfter = rateLimit(
    requestRateLimitKey(request, scope),
    options.limit ?? 10,
    options.windowMs ?? 60_000,
  );
  return retryAfter ? rateLimitResponse(retryAfter) : null;
}

export function resetRateLimiterForTests() {
  buckets.clear();
}
