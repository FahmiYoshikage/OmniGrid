import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { absoluteUrl } from '@/lib/seo';

const BRAND_NAME = 'OmniGrid Network Architecture';

export const metadata: Metadata = {
    title: `Privacy Policy | ${BRAND_NAME}`,
    description: `Privacy Policy for ${BRAND_NAME}, including how authentication data from Google OAuth, GitHub OAuth, and email sign-in is handled.`,
    alternates: {
        canonical: absoluteUrl('/privacy-policy'),
    },
};

const sections = [
    {
        title: 'Information we collect',
        body: [
            `${BRAND_NAME} collects only the information necessary to operate the service securely. Depending on the login method you choose, this may include your name, email address, profile image, provider account identifier, and basic authentication metadata.`,
            `If you sign in with Google OAuth or GitHub OAuth, ${BRAND_NAME} receives the profile data explicitly granted by you through that provider's consent screen. If you sign in by email magic link, ${BRAND_NAME} stores your email address and temporary authentication token metadata required to verify the request.`,
        ],
    },
    {
        title: 'How we use your information',
        body: [
            `We use account information to authenticate you, link one or more login methods to the same ${BRAND_NAME} account, maintain session security, personalize your workspace, and operate core infrastructure management features.`,
            `${BRAND_NAME} does not use Google user data for advertising, data brokerage, or unrelated profiling. Google OAuth data is used only for sign-in, account linking, fraud prevention, and service security.`,
        ],
    },
    {
        title: 'Google OAuth and limited use',
        body: [
            `When you sign in with Google, ${BRAND_NAME} accesses only the minimum profile scopes requested in the consent screen, such as your basic profile and email address, to verify identity and associate your login with a ${BRAND_NAME} account.`,
            `${BRAND_NAME} does not sell Google user data, does not transfer Google user data to third parties except as necessary to provide or secure the service, and does not use Google user data for any purpose prohibited by Google's API Services User Data Policy.`,
        ],
    },
    {
        title: 'How we store and protect data',
        body: [
            `Authentication sessions are stored server-side. Sensitive integration secrets are encrypted at rest. ${BRAND_NAME} applies reasonable technical and organizational safeguards designed to protect account data against unauthorized access, loss, misuse, or alteration.`,
            'Temporary OAuth state, PKCE verifier data, and email sign-in tokens are stored only as long as needed to complete authentication flows and are removed after use or expiration.',
        ],
    },
    {
        title: 'Data sharing',
        body: [
            `${BRAND_NAME} does not sell personal information. We may share limited data with infrastructure providers or subprocessors only when necessary to host, secure, or deliver the service.`,
            'We may also disclose information when required by law, to enforce our rights, or to investigate abuse, fraud, or security incidents.',
        ],
    },
    {
        title: 'Data retention',
        body: [
            'We retain account and authentication data only for as long as reasonably necessary to operate the service, comply with legal obligations, resolve disputes, and enforce our agreements.',
            'You may request account deletion through the service operator. Some records may be retained for legitimate security, fraud-prevention, compliance, or audit purposes where required.',
        ],
    },
    {
        title: 'Your choices and rights',
        body: [
            `You may choose which login method to use and, where supported, link or unlink authentication methods from your ${BRAND_NAME} account. You may also choose not to use Google OAuth at all.`,
            `Depending on your jurisdiction, you may have rights to access, correct, delete, or restrict the processing of your personal data. Requests should be directed to the ${BRAND_NAME} service operator or support contact for your deployment.`,
        ],
    },
    {
        title: "Children's privacy",
        body: [
            `${BRAND_NAME} is not directed to children under 13, and we do not knowingly collect personal information from children. If you believe a child has provided personal data, contact the service operator so the information can be removed where appropriate.`,
        ],
    },
    {
        title: 'Changes to this policy',
        body: [
            `We may update this Privacy Policy from time to time to reflect product, security, legal, or operational changes. Continued use of ${BRAND_NAME} after an updated policy becomes effective constitutes acceptance of the revised policy.`,
        ],
    },
    {
        title: 'Contact',
        body: [
            `For privacy questions, data access requests, or account deletion requests, contact the operator or support contact of the ${BRAND_NAME} deployment you are using.`,
        ],
    },
];

export default function PrivacyPolicyPage() {
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
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                            <ShieldCheck className="h-4 w-4" />
                            Privacy Policy
                        </div>
                    </div>
                    <Breadcrumbs
                        items={[{ label: 'Privacy Policy', href: '/privacy-policy' }]}
                        className="mt-4"
                    />

                    <div className="pt-8">
                        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                            Privacy Policy
                        </h1>
                        <p className="mt-4 text-sm leading-7 text-slate-300">
                            Effective date: May 26, 2026. This Privacy Policy
                            explains how {BRAND_NAME} collects, uses, stores,
                            and protects information when you access the
                            service, including when you sign in with Google
                            OAuth, GitHub OAuth, or email magic links.
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
                            href="/terms"
                            className="transition hover:text-white"
                        >
                            Terms of Service
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
