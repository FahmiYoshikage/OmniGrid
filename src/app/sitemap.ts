import type { MetadataRoute } from 'next';
import { absoluteUrl, PUBLIC_INDEXABLE_PATHS } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    const priorities: Record<(typeof PUBLIC_INDEXABLE_PATHS)[number], number> = {
        '/': 1,
        '/docs': 0.9,
        '/privacy-policy': 0.3,
        '/terms': 0.3,
    };

    return PUBLIC_INDEXABLE_PATHS.map((path) => ({
        url: absoluteUrl(path),
        lastModified: now,
        changeFrequency: path === '/docs' ? 'weekly' : 'monthly',
        priority: priorities[path],
    }));
}
