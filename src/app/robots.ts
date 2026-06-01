import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: ['/', '/docs', '/privacy-policy', '/terms', '/logo.png', '/logo.svg'],
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
            ],
        },
        sitemap: absoluteUrl('/sitemap.xml'),
    };
}
