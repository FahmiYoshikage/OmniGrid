import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import '@xyflow/react/dist/style.css';
import { AppShell } from '@/components/app-shell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { getSessionUser } from '@/lib/auth/session';
import { absoluteUrl, getLocalBusinessSchema, getOrganizationSchema, getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    applicationName: SITE_NAME,
    title: {
        default: `${SITE_NAME} - Zero Trust Server Operations`,
        template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
        'OmniGrid',
        'Zero Trust server operations',
        'homelab dashboard',
        'SSH terminal',
        'Tailscale topology',
        'Cloudflare Tunnel',
        'Docker workload discovery',
        'private infrastructure',
    ],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    alternates: {
        canonical: absoluteUrl('/'),
    },
    verification: {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION || undefined,
        yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || process.env.YANDEX_VERIFICATION || undefined,
        yahoo: process.env.NEXT_PUBLIC_YAHOO_VERIFICATION || undefined,
    },
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: absoluteUrl('/'),
        siteName: SITE_NAME,
        title: `${SITE_NAME} - Zero Trust Server Operations`,
        description: SITE_DESCRIPTION,
        images: [
            {
                url: absoluteUrl('/logo.png'),
                width: 512,
                height: 512,
                alt: SITE_NAME,
            },
        ],
    },
    twitter: {
        card: 'summary',
        title: `${SITE_NAME} - Zero Trust Server Operations`,
        description: SITE_DESCRIPTION,
        images: [absoluteUrl('/logo.png')],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
        },
    },
    category: 'technology',
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/logo.svg', type: 'image/svg+xml' },
        ],
        shortcut: '/favicon.ico',
        apple: '/logo.png',
    },
    manifest: '/site.webmanifest',
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Get current user (null if not logged in)
    let user: {
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
    } | null = null;
    try {
        const sessionUser = await getSessionUser();
        if (sessionUser) {
            user = {
                username: sessionUser.username,
                displayName: sessionUser.displayName,
                avatarUrl: sessionUser.avatarUrl,
            };
        }
    } catch {
        // Session lookup may fail during build or when DB is not ready
    }

    const orgSchema = getOrganizationSchema();
    const localBusinessSchema = getLocalBusinessSchema();

    return (
        <html
            lang="en"
            className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <head>
                <script
                    type="application/ld+json"
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(orgSchema),
                    }}
                />
                <script
                    type="application/ld+json"
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(localBusinessSchema),
                    }}
                />
            </head>
            <body className="min-h-full flex flex-col">
                <TooltipProvider delay={150}>
                    <AppShell user={user}>{children}</AppShell>
                    <Toaster richColors position="top-right" />
                </TooltipProvider>
            </body>
        </html>
    );
}
