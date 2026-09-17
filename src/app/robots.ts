import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: [
                '/',
                '/docs',
                '/privacy-policy',
                '/terms',
                '/logo.png',
                '/logo.svg',
                '/favicon.ico',
                '/site.webmanifest',
            ],
            disallow: [
                '/api/',
                '/auth/',
                '/dashboard',
                '/topology',
                '/nodes',
                '/credentials',
                '/terminal',
                '/containers',
                '/tunnels',
                '/uptime',
                '/settings',
                '/login',
                '/runbooks',
                '/audit',
                '/wol',
                '/invitations/',
            ],
        },
        sitemap: absoluteUrl('/sitemap.xml'),
    };
}
