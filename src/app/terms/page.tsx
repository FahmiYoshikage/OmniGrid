import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { FileText } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { absoluteUrl } from '@/lib/seo';

const BRAND_NAME = 'OmniGrid Network Architecture';

export const metadata: Metadata = {
    title: `Terms of Service | ${BRAND_NAME}`,
    description: `Terms of Service for ${BRAND_NAME}, the Zero Trust server operations platform.`,
    alternates: {
        canonical: absoluteUrl('/terms'),
    },
};

const sections = [
    {
        title: 'Acceptance of terms',
        body: [
            `By accessing or using ${BRAND_NAME}, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the service.`,
            `If you use ${BRAND_NAME} on behalf of an organization, you represent that you have authority to bind that organization to these terms.`,
        ],
    },
    {
        title: 'Service description',
        body: [
            `${BRAND_NAME} provides a web-based Zero Trust server operations platform that may include authentication, infrastructure visibility, terminal access, credential management, integration settings, and related administrative features.`,
            'Features may change over time, and some functionality may depend on third-party integrations such as Google, GitHub, Cloudflare, Tailscale, or email infrastructure providers.',
        ],
    },
    {
        title: 'Accounts and authentication',
        body: [
            'You are responsible for maintaining the confidentiality of your account access methods and for all activities that occur under your account.',
            `You must provide accurate information during authentication and may not impersonate another person or entity. ${BRAND_NAME} may suspend or terminate access where we reasonably suspect unauthorized use, abuse, or security risks.`,
        ],
    },
    {
        title: 'Acceptable use',
        body: [
            `You agree not to use ${BRAND_NAME} to violate any law, infringe any rights, interfere with service operations, attempt unauthorized access, distribute malware, abuse third-party APIs, or perform harmful or deceptive activities.`,
            `You are solely responsible for the infrastructure, credentials, systems, and data you connect to ${BRAND_NAME}.`,
        ],
    },
    {
        title: 'Third-party services',
        body: [
            `${BRAND_NAME} may integrate with third-party platforms including Google OAuth, GitHub OAuth, Gmail SMTP, Cloudflare, and Tailscale. Your use of those services is also subject to their respective terms and privacy policies.`,
            'We are not responsible for outages, security events, API changes, or policy decisions made by third-party providers.',
        ],
    },
    {
        title: 'Data, security, and backups',
        body: [
            `${BRAND_NAME} implements security controls designed to protect service data, but no system is completely secure. You acknowledge that use of the service is at your own risk.`,
            `You remain responsible for maintaining your own backups, security configurations, access policies, and recovery plans for any infrastructure managed through ${BRAND_NAME}.`,
        ],
    },
    {
        title: 'Intellectual property',
        body: [
            `All rights, title, and interest in and to ${BRAND_NAME}, excluding your own content and infrastructure data, remain with the service owner or its licensors.`,
            `You may not copy, reverse engineer, redistribute, or create derivative works from ${BRAND_NAME} except as permitted by applicable law or explicit written permission.`,
        ],
    },
    {
        title: 'Termination',
        body: [
            `We may suspend or terminate access to ${BRAND_NAME} at any time if necessary to protect the service, comply with legal obligations, investigate misuse, or respond to security incidents.`,
            'You may stop using the service at any time. Certain provisions of these terms survive termination, including provisions relating to liability, disclaimers, intellectual property, and dispute resolution.',
        ],
    },
    {
        title: 'Disclaimers',
        body: [
            `${BRAND_NAME} is provided on an \"as is\" and \"as available\" basis to the maximum extent permitted by law. We disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.`,
            'We do not guarantee uninterrupted availability, complete accuracy, or error-free operation.',
        ],
    },
    {
        title: 'Limitation of liability',
        body: [
            `To the maximum extent permitted by law, ${BRAND_NAME} and its operators will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenues, data, goodwill, or business opportunities arising from or related to your use of the service.`,
            'Where liability cannot be excluded, it will be limited to the amount you paid, if any, for the service during the twelve months preceding the event giving rise to the claim.',
        ],
    },
    {
        title: 'Changes to these terms',
        body: [
            `We may update these Terms of Service from time to time. Continued use of ${BRAND_NAME} after revised terms become effective constitutes acceptance of the updated terms.`,
        ],
    },
    {
        title: 'Contact',
        body: [
            `For legal, support, or account-related questions, contact the operator or support contact of the ${BRAND_NAME} deployment you use.`,
        ],
    },
];

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-slate-950 px-6 py-10 text-white lg:px-10">
            <div className="mx-auto max-w-4xl">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                                <Image
                                    src="/logo.svg"
                                    alt={BRAND_NAME}
                                    width={28}
                                    height={28}
                                    priority
                                />
                            </div>
                            <div>
                                <div className="font-bold tracking-tight">
                                    {BRAND_NAME}
                                </div>
                                <div className="text-xs text-cyan-100/60">
                                    Zero Trust server operations
                                </div>
                            </div>
                        </Link>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                            <FileText className="h-4 w-4" />
                            Terms of Service
                        </div>
                    </div>
                    <Breadcrumbs
                        items={[{ label: 'Terms of Service', href: '/terms' }]}
                        className="mt-4"
                    />

                    <div className="pt-8">
                        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                            Terms of Service
                        </h1>
                        <p className="mt-4 text-sm leading-7 text-slate-300">
                            Effective date: May 26, 2026. These Terms of Service
                            govern your access to and use of {BRAND_NAME} and
                            any related features, pages, APIs, and integrations
                            made available through the service.
                        </p>
                    </div>

                    <div className="mt-10 space-y-8">
                        {sections.map((section) => (
                            <section
                                key={section.title}
                                className="rounded-3xl border border-white/10 bg-black/20 p-6"
                            >
                                <h2 className="text-xl font-semibold tracking-tight">
                                    {section.title}
                                </h2>
                                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                                    {section.body.map((paragraph) => (
                                        <p key={paragraph}>{paragraph}</p>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>

                    <div className="mt-10 flex flex-wrap gap-3 border-t border-white/10 pt-6 text-sm text-slate-400">
                        <Link
                            href="/privacy-policy"
                            className="transition hover:text-white"
                        >
                            Privacy Policy
                        </Link>
                        <span>•</span>
                        <Link
                            href="/login"
                            className="transition hover:text-white"
                        >
                            Sign in
                        </Link>
                        <span>•</span>
                        <Link href="/" className="transition hover:text-white">
                            Back to {BRAND_NAME}
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
