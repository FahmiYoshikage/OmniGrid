import Image from 'next/image';
import Link from 'next/link';
import {
    ArrowRight,
    Boxes,
    Cloud,
    Database,
    FileText,
    Gauge,
    Globe2,
    KeyRound,
    LockKeyhole,
    Network,
    Router,
    Server,
    ShieldCheck,
    TerminalSquare,
    Workflow,
} from 'lucide-react';
import { CopyCommandButton } from './copy-command-button';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

const BRAND_NAME = 'OmniGrid Network Architecture';
const BOOTSTRAP_CMD =
    'curl -fsSL https://gist.githubusercontent.com/FahmiYoshikage/38fbbbfe4ab544bb16e9844efec64e51/raw/ce59bb410f50f0f13096068de5d77695c1f4b077/omnigrid-bootstrap.sh | sudo bash';

const ARCHITECTURE_RULES = [
    {
        icon: Server,
        title: 'Every host runs Docker',
        description:
            'Managed machines keep workloads predictable and inspectable from the control plane.',
    },
    {
        icon: Network,
        title: 'Shared omnigrid-net',
        description:
            'Containers attached to the external network become discoverable across registered hosts.',
    },
    {
        icon: TerminalSquare,
        title: 'SSH stays backend-only',
        description:
            'The browser never receives raw keys; sessions are brokered by the server with audit context.',
    },
    {
        icon: Cloud,
        title: 'Zero Trust ingress',
        description:
            'Cloudflare Tunnel or an equivalent ingress exposes apps without opening inbound server ports.',
    },
];

const WORKFLOW = [
    {
        step: '01',
        title: 'Bootstrap',
        body: 'Run the one-liner on a Linux host to install Docker and prepare omnigrid-net.',
    },
    {
        step: '02',
        title: 'Register',
        body: 'Add the host, SSH profile, and workspace credentials through OmniGrid.',
    },
    {
        step: '03',
        title: 'Discover',
        body: 'Scan Docker workloads over SSH and surface containers attached to omnigrid-net.',
    },
    {
        step: '04',
        title: 'Operate',
        body: 'Open SSH tabs, inspect topology, publish tunnels, and monitor uptime from one cockpit.',
    },
];

const CAPABILITIES = [
    {
        icon: KeyRound,
        title: 'Encrypted credential vault',
        body: 'AES-256-GCM secret storage for private keys, passwords, OAuth tokens, and integration settings.',
    },
    {
        icon: Router,
        title: 'Tailscale-aware topology',
        body: 'Blend tailnet device visibility with OmniGrid nodes so operators can see private fleet shape quickly.',
    },
    {
        icon: Globe2,
        title: 'Cloudflare Tunnel control',
        body: 'Inspect tunnels, published hostnames, Access apps, zones, and DNS records from workspace credentials.',
    },
    {
        icon: Gauge,
        title: 'Operations dashboard',
        body: 'Track node inventory, recent audit activity, uptime monitors, containers, and tunnel exposure.',
    },
    {
        icon: LockKeyhole,
        title: 'Multi-login identity',
        body: 'GitHub, Google, and email magic links can attach to one account without duplicating workspaces.',
    },
    {
        icon: Database,
        title: 'Workspace scope',
        body: 'Customer-owned integration secrets live per workspace, not as global platform environment variables.',
    },
];

export function LandingPage() {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        url: absoluteUrl('/'),
        image: absoluteUrl('/logo.png'),
        description: SITE_DESCRIPTION,
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
    };

    return (
        <main className="min-h-screen overflow-hidden bg-zinc-950 text-zinc-50">
            <script
                type="application/ld+json"
                suppressHydrationWarning
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(structuredData),
                }}
            />
            <section className="relative isolate min-h-screen overflow-hidden">
                <NetworkBackdrop />
                <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
                    <nav className="flex items-center justify-between gap-4 border-b border-white/10 py-4">
                        <Link href="/" className="flex min-w-0 items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/10 ring-1 ring-white/15">
                                <Image
                                    src="/logo.svg"
                                    alt={BRAND_NAME}
                                    width={28}
                                    height={28}
                                    priority
                                />
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-black sm:text-base">
                                    {BRAND_NAME}
                                </div>
                                <div className="hidden text-xs text-lime-100/65 sm:block">
                                    Zero Trust server operations standard
                                </div>
                            </div>
                        </Link>
                        <div className="flex shrink-0 items-center gap-2">
                            <Link
                                href="/docs"
                                className="inline-flex h-10 items-center rounded-md border border-white/12 px-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                            >
                                Docs
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex h-10 items-center rounded-md bg-zinc-50 px-3 text-sm font-bold text-zinc-950 transition hover:bg-lime-200"
                            >
                                Sign in
                            </Link>
                        </div>
                    </nav>

                    <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-14">
                        <div>
                            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-lime-300/25 bg-lime-300/10 px-3 py-2 text-sm font-medium text-lime-100">
                                <ShieldCheck className="h-4 w-4" />
                                Control plane for private servers, homelabs, and VPS fleets
                            </div>
                            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-normal sm:text-6xl lg:text-7xl">
                                OmniGrid Network Architecture
                            </h1>
                            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                                A Zero Trust operations standard for preparing
                                Linux hosts, discovering Docker workloads,
                                brokering SSH, mapping Tailscale topology, and
                                publishing internal services without opening
                                inbound ports.
                            </p>

                            <div className="mt-8 max-w-3xl border border-white/12 bg-zinc-950/85 p-3 shadow-2xl shadow-black/40 backdrop-blur">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-xs font-bold uppercase text-lime-200">
                                            Bootstrap any Linux node
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-500">
                                            Docker + external omnigrid-net baseline
                                        </div>
                                    </div>
                                    <CopyCommandButton command={BOOTSTRAP_CMD} />
                                </div>
                                <pre className="overflow-x-auto rounded-md bg-black/60 p-4 text-xs leading-6 text-zinc-100 ring-1 ring-white/10 sm:text-sm">
                                    <code>{BOOTSTRAP_CMD}</code>
                                </pre>
                            </div>

                            <div className="mt-7 flex flex-wrap gap-3">
                                <Link
                                    href="/login"
                                    className="inline-flex h-12 items-center gap-2 rounded-md bg-lime-300 px-5 text-sm font-black text-zinc-950 transition hover:bg-lime-200"
                                >
                                    Open control plane
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    href="/docs#bootstrap"
                                    className="inline-flex h-12 items-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-5 text-sm font-bold text-white transition hover:bg-white/10"
                                >
                                    Read bootstrap docs
                                </Link>
                            </div>
                        </div>

                        <div className="relative min-h-[30rem] overflow-hidden border border-white/12 bg-zinc-950/75 p-4 shadow-2xl shadow-black/40 backdrop-blur">
                            <div className="grid gap-3 md:grid-cols-[0.88fr_1.12fr]">
                                <div className="space-y-3">
                                    <StatusBlock
                                        label="Fleet"
                                        value="8 nodes"
                                        tone="lime"
                                        detail="homelab + VPS"
                                    />
                                    <StatusBlock
                                        label="Ingress"
                                        value="Cloudflare"
                                        tone="cyan"
                                        detail="no inbound ports"
                                    />
                                    <StatusBlock
                                        label="Vault"
                                        value="AES-256-GCM"
                                        tone="amber"
                                        detail="workspace scoped"
                                    />
                                </div>
                                <div className="border border-white/10 bg-black/40 p-4">
                                    <div className="mb-4 flex items-center justify-between text-xs">
                                        <span className="font-bold uppercase text-zinc-400">
                                            Live topology
                                        </span>
                                        <span className="rounded-md bg-lime-300/15 px-2 py-1 text-lime-100">
                                            online
                                        </span>
                                    </div>
                                    <div className="relative h-80 overflow-hidden rounded-md border border-white/10 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:34px_34px]">
                                        <NodePin className="left-[10%] top-[16%]" label="nas" tone="lime" />
                                        <NodePin className="right-[12%] top-[22%]" label="vps-01" tone="cyan" />
                                        <NodePin className="bottom-[18%] left-[18%]" label="edge" tone="amber" />
                                        <NodePin className="bottom-[14%] right-[18%]" label="apps" tone="rose" />
                                        <div className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border border-lime-300/30 bg-lime-300/10 text-center shadow-2xl shadow-lime-950/50">
                                            <Image
                                                src="/logo.svg"
                                                alt=""
                                                width={34}
                                                height={34}
                                            />
                                            <span className="text-[10px] font-bold uppercase text-lime-100">
                                                control
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <MiniTerminal title="containers" body="docker ps --filter network=omnigrid-net" />
                                <MiniTerminal title="ssh" body="open pty -> vps-prod-01" />
                                <MiniTerminal title="audit" body="session closed · 14m idle" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-white/10 bg-zinc-900 px-5 py-14 sm:px-8 lg:px-10">
                <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr]">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                            <Workflow className="h-4 w-4" />
                            Architecture standard
                        </div>
                        <h2 className="text-3xl font-black tracking-normal sm:text-4xl">
                            The rulebook behind the dashboard.
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-zinc-300">
                            OmniGrid is not just another admin panel. It defines
                            the host baseline, network boundary, access method,
                            and secret scope needed for a private fleet to be
                            operated from one web control plane.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {ARCHITECTURE_RULES.map((item) => {
                            const Icon = item.icon;
                            return (
                                <article
                                    key={item.title}
                                    className="border border-white/10 bg-white/[0.035] p-5"
                                >
                                    <Icon className="h-5 w-5 text-lime-200" />
                                    <h3 className="mt-4 font-bold">
                                        {item.title}
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                                        {item.description}
                                    </p>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="bg-zinc-950 px-5 py-16 sm:px-8 lg:px-10">
                <div className="mx-auto max-w-7xl">
                    <div className="flex flex-col justify-between gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
                                <Boxes className="h-4 w-4" />
                                Bootstrap to operate
                            </div>
                            <h2 className="text-3xl font-black tracking-normal sm:text-4xl">
                                One command starts the workflow, not the documentation maze.
                            </h2>
                        </div>
                        <Link
                            href="/docs"
                            className="inline-flex h-11 w-fit items-center gap-2 rounded-md border border-white/12 px-4 text-sm font-bold text-zinc-100 transition hover:bg-white/10"
                        >
                            <FileText className="h-4 w-4" />
                            Full documentation
                        </Link>
                    </div>

                    <div className="mt-8 grid gap-3 md:grid-cols-4">
                        {WORKFLOW.map((item) => (
                            <article
                                key={item.step}
                                className="border border-white/10 bg-white/[0.035] p-5"
                            >
                                <div className="text-sm font-black text-lime-200">
                                    {item.step}
                                </div>
                                <h3 className="mt-5 text-xl font-black">
                                    {item.title}
                                </h3>
                                <p className="mt-3 text-sm leading-6 text-zinc-400">
                                    {item.body}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-y border-white/10 bg-zinc-900 px-5 py-16 sm:px-8 lg:px-10">
                <div className="mx-auto max-w-7xl">
                    <div className="max-w-3xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-rose-300/10 px-3 py-2 text-sm font-bold text-rose-100">
                            <ShieldCheck className="h-4 w-4" />
                            Platform capabilities
                        </div>
                        <h2 className="text-3xl font-black tracking-normal sm:text-4xl">
                            Built for multi-user Zero Trust operations.
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-zinc-300">
                            The product direction is public SaaS: platform
                            secrets stay in environment variables, while user
                            integration credentials are encrypted per workspace
                            and consumed by authenticated API routes.
                        </p>
                    </div>

                    <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {CAPABILITIES.map((item) => {
                            const Icon = item.icon;
                            return (
                                <article
                                    key={item.title}
                                    className="border border-white/10 bg-zinc-950/70 p-5"
                                >
                                    <Icon className="h-5 w-5 text-cyan-200" />
                                    <h3 className="mt-4 font-bold">
                                        {item.title}
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                                        {item.body}
                                    </p>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="bg-zinc-950 px-5 py-14 sm:px-8 lg:px-10">
                <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border border-white/10 bg-white/[0.035] p-6 sm:p-8 lg:flex-row lg:items-center">
                    <div>
                        <div className="text-sm font-bold uppercase text-lime-200">
                            Ready baseline
                        </div>
                        <h2 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">
                            Prepare a node, then manage it from OmniGrid.
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
                            Start with the one-line bootstrap, register the host
                            in the dashboard, and use docs when you need deeper
                            Cloudflare, auth, or deployment details.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/login"
                            className="inline-flex h-12 items-center gap-2 rounded-md bg-lime-300 px-5 text-sm font-black text-zinc-950 transition hover:bg-lime-200"
                        >
                            Sign in
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/docs"
                            className="inline-flex h-12 items-center rounded-md border border-white/12 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                            Documentation
                        </Link>
                    </div>
                </div>

                <footer className="mx-auto mt-8 flex max-w-7xl flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
                    <Link href="/docs" className="transition hover:text-white">
                        Documentation
                    </Link>
                    <span>/</span>
                    <Link
                        href="/privacy-policy"
                        className="transition hover:text-white"
                    >
                        Privacy Policy
                    </Link>
                    <span>/</span>
                    <Link href="/terms" className="transition hover:text-white">
                        Terms of Service
                    </Link>
                </footer>
            </section>
        </main>
    );
}

function NetworkBackdrop() {
    return (
        <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(190,242,100,.18),transparent_32%),radial-gradient(circle_at_72%_18%,rgba(103,232,249,.16),transparent_30%),radial-gradient(circle_at_55%_76%,rgba(251,191,36,.12),transparent_28%),linear-gradient(135deg,#09090b_0%,#18181b_48%,#09090b_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:58px_58px]" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent" />
        </div>
    );
}

function StatusBlock({
    label,
    value,
    tone,
    detail,
}: {
    label: string;
    value: string;
    tone: 'lime' | 'cyan' | 'amber';
    detail: string;
}) {
    const toneClass = {
        lime: 'text-lime-200 bg-lime-300/10',
        cyan: 'text-cyan-200 bg-cyan-300/10',
        amber: 'text-amber-200 bg-amber-300/10',
    }[tone];

    return (
        <div className="border border-white/10 bg-black/35 p-4">
            <div className={`mb-4 inline-flex rounded-md px-2 py-1 text-xs font-bold ${toneClass}`}>
                {label}
            </div>
            <div className="text-2xl font-black">{value}</div>
            <div className="mt-1 text-xs text-zinc-500">{detail}</div>
        </div>
    );
}

function NodePin({
    className,
    label,
    tone,
}: {
    className: string;
    label: string;
    tone: 'lime' | 'cyan' | 'amber' | 'rose';
}) {
    const toneClass = {
        lime: 'border-lime-300/40 bg-lime-300/15 text-lime-100',
        cyan: 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100',
        amber: 'border-amber-300/40 bg-amber-300/15 text-amber-100',
        rose: 'border-rose-300/40 bg-rose-300/15 text-rose-100',
    }[tone];

    return (
        <div
            className={`absolute rounded-md border px-2 py-1 text-[11px] font-bold uppercase ${toneClass} ${className}`}
        >
            {label}
        </div>
    );
}

function MiniTerminal({ title, body }: { title: string; body: string }) {
    return (
        <div className="min-w-0 border border-white/10 bg-black/45 p-3 font-mono">
            <div className="text-[10px] uppercase text-zinc-500">{title}</div>
            <div className="mt-2 truncate text-xs text-zinc-200">{body}</div>
        </div>
    );
}
