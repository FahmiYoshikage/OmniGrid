import { getEnv } from '@/lib/env';

export function buildPublicUrl(path: string, requestUrl?: string): URL {
    const env = getEnv();
    const base = env.OMNIGRID_PUBLIC_URL?.replace(/\/$/, '');
    if (base) {
        return new URL(path, base);
    }
    if (requestUrl) {
        return new URL(path, requestUrl);
    }
    throw new Error('Missing OMNIGRID_PUBLIC_URL environment variable.');
}
