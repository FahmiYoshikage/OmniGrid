export const SITE_NAME = 'OmniGrid Network Architecture';
export const SITE_SHORT_NAME = 'OmniGrid';
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

/** Schema.org Organization structured data */
export function getOrganizationSchema() {
    const url = getSiteUrl();
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        alternateName: SITE_SHORT_NAME,
        url,
        logo: absoluteUrl('/logo.png'),
        image: absoluteUrl('/logo.png'),
        description: SITE_DESCRIPTION,
        sameAs: [
            'https://github.com/FahmiYoshikage/OmniGrid',
        ],
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'technical support',
            url: `${url}/docs`,
        },
    };
}

/** Schema.org Local / Professional Business IT Provider structured data */
export function getLocalBusinessSchema() {
    const url = getSiteUrl();
    return {
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        name: SITE_NAME,
        alternateName: SITE_SHORT_NAME,
        image: absoluteUrl('/logo.png'),
        url,
        description: SITE_DESCRIPTION,
        priceRange: '$$',
        address: {
            '@type': 'PostalAddress',
            addressCountry: 'ID',
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: -6.2088,
            longitude: 106.8456,
        },
        openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
                'Sunday',
            ],
            opens: '00:00',
            closes: '23:59',
        },
    };
}

/** Schema.org SoftwareApplication structured data */
export function getSoftwareApplicationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, Docker, Web',
        url: absoluteUrl('/'),
        image: absoluteUrl('/logo.png'),
        description: SITE_DESCRIPTION,
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
    };
}

/** Schema.org BreadcrumbList structured data */
export function getBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path),
        })),
    };
}
