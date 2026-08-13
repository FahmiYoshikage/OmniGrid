export const SITE_NAME = 'OmniGrid Network Architecture';
export const SITE_DESCRIPTION =
    'Zero Trust server operations platform for homelabs, private fleets, SSH access, Docker workload discovery, topology, and Cloudflare Tunnel workflows.';

export const PUBLIC_INDEXABLE_PATHS = [
    '/',
    '/docs',
    '/privacy-policy',
    '/terms',
] as const;

export function getSiteUrl() {
    return (process.env.OMNIGRID_PUBLIC_URL || 'http://localhost:3000').replace(
        /\/$/,
        ''
    );
}

export function absoluteUrl(path = '/') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${getSiteUrl()}${normalizedPath}`;
}

export function isPublicIndexablePath(pathname: string) {
    return PUBLIC_INDEXABLE_PATHS.includes(
        pathname as (typeof PUBLIC_INDEXABLE_PATHS)[number]
    );
}
