import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
    Activity,
    ArrowRight,
    Boxes,
    Cloud,
    Database,
    FileText,
    Gauge,
    GitBranch,
    Globe,
    KeyRound,
    LockKeyhole,
    Network,
    Server,
    ShieldCheck,
    TerminalSquare,
} from 'lucide-react';
import { CopyCommandButton } from '../copy-command-button';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

const BRAND_NAME = 'OmniGrid Network Architecture';
const BOOTSTRAP_CMD =
    'curl -fsSL https://gist.githubusercontent.com/FahmiYoshikage/38fbbbfe4ab544bb16e9844efec64e51/raw/ce59bb410f50f0f13096068de5d77695c1f4b077/omnigrid-bootstrap.sh | sudo bash';

const NAV_ITEMS = [
    { href: '#start-here', label: 'Start here' },
    { href: '#mental-model', label: 'Mental model' },
    { href: '#terms', label: 'Core terms' },
    { href: '#quickstart', label: 'Quickstart' },
    { href: '#architecture', label: 'Architecture' },
    { href: '#features', label: 'Feature guides' },
    { href: '#security', label: 'Security model' },
    { href: '#production', label: 'Production notes' },
];

const TERMS = [
    {
        term: 'Workspace',
        icon: Database,
        definition:
            'A workspace is the tenant boundary for settings, nodes, credentials, integrations, audit data, and monitors. In SaaS mode, every customer-owned secret belongs to a workspace.',
        example:
            'If two teams connect different Cloudflare accounts or SSH profiles, their tokens and node inventory stay isolated in separate workspaces.',
    },
    {
        term: 'Node',
        icon: Server,
        definition:
            'A node is a managed host that OmniGrid can reach over SSH (Port 22). It can be a homelab machine, VPS, NAS, router box, or any Linux server prepared for the OmniGrid baseline.',
        example:
            'Examples: homelab-nas, vps-prod-01, edge-server, media-host.',
    },
    {
        term: 'omnigrid-net',
        icon: Network,
        definition:
            'omnigrid-net is the shared external Docker network used as the discovery and routing boundary. Containers attached to this network can communicate with Cloudflare Tunnel and the OmniGrid control plane.',
        example:
            'The bootstrap command creates the Docker network so app containers can join it via networks: omnigrid-net (external: true).',
    },
    {
        term: 'Credential profile',
        icon: KeyRound,
        definition:
            'A reusable SSH authentication profile stored in the encrypted vault. Profiles can represent private keys, passwords, or agent-oriented access patterns.',
        example:
            'Use one profile for all Ubuntu VPS nodes and another profile for local homelab machines.',
    },
    {
        term: 'Control plane',
        icon: Gauge,
        definition:
            'The OmniGrid web application and backend server. It owns session auth, route handlers, Socket.IO SSH sessions, database access, and encrypted integration settings.',
        example:
            'Operators click in the browser, but SSH handshakes and Cloudflare API calls happen securely in the backend control plane.',
    },
    {
        term: 'Tunnel',
        icon: Cloud,
        definition:
            'A Zero Trust ingress path using Cloudflare Tunnel, used to expose internal services to public hostnames directly using container names (http://container_name:port) without opening inbound ports.',
        example:
            'Publish vault.example.com directly to http://vaultwarden-app:80 through Cloudflare Tunnel.',
    },
    {
        term: 'Topology',
        icon: GitBranch,
        definition:
            'A visual map of private infrastructure. OmniGrid renders node connectivity and status so operators can understand fleet shape quickly.',
        example:
            'Use topology to see which nodes are online and inspect node tags before deploying workloads.',
    },
    {
        term: 'Monitor',
        icon: Activity,
        definition:
            'An uptime check for internal or external endpoints. Monitors help validate that published services, SSL certificates, and private apps remain reachable.',
        example:
            'Track https://vault.example.com or an internal service endpoint with automatic failure alerts.',
    },
];

const QUICKSTART_STEPS = [
    {
        title: 'Prepare the control plane',
        body: 'Install dependencies, generate OMNIGRID_MASTER_KEY, create .env.local, configure at least one login method, then run migrations.',
        code: 'npm install\nnpm run keygen\ncp .env.example .env.local\nnpm run db:migrate',
    },
    {
        title: 'Bootstrap a Linux node',
        body: 'Run the one-line script on a host you want OmniGrid to manage. This prepares Docker, omnigrid-net, /opt/cloudflared, and compose templates.',
        code: BOOTSTRAP_CMD,
    },
    {
        title: 'Register the node',
        body: 'Open the dashboard, create or select a credential profile, then add the host IP, SSH port 22, and user in Nodes.',
        code: 'Dashboard -> Credentials -> New profile\nDashboard -> Nodes -> Add node',
    },
    {
        title: 'Deploy & Operate',
        body: 'Deploy services into /opt/<app-name> using omnigrid-net, publish hostnames via Cloudflare Zero Trust, open SSH tabs, and monitor uptime.',
        code: 'cp /opt/omnigrid/docker-compose.template.yml /opt/my-app/docker-compose.yml\nTunnels -> Published apps\nContainers -> Live logs',
    },
];

const FEATURE_GUIDES = [
    {
        icon: TerminalSquare,
        title: 'Terminal',
        body: 'Use Terminal when you need an interactive shell on a registered node. OmniGrid opens SSH from the backend, multiplexes tabs through Socket.IO, retains buffers, and closes idle sessions.',
        learn:
            'Teach operators to think of the browser terminal as a controlled SSH broker, not a place where raw private keys live.',
    },
    {
        icon: Boxes,
        title: 'Containers',
        body: 'Use Containers to discover workloads that belong to the OmniGrid standard. Discovery runs docker ps through SSH and focuses on containers attached to omnigrid-net.',
        learn:
            'If a container does not appear, check whether it is attached to omnigrid-net on the target host.',
    },
    {
        icon: Globe,
        title: 'Cloudflare Tunnel',
        body: 'Use Tunnels to manage Cloudflare Zero Trust ingress, published hostnames, Access apps, zones, and DNS CNAME records without opening firewall ports on managed hosts.',
        learn:
            'Cloudflare ingress rules map public domains directly to internal container names, e.g. http://<container_name>:<port>.',
    },
    {
        icon: Activity,
        title: 'Uptime',
        body: 'Use Uptime to check internal or public endpoints, monitor SSL certificate expiration, and keep incident context close to the rest of the operations cockpit.',
        learn:
            'Monitors should represent operator questions: is the service reachable, is the tunnel alive, and when did it fail.',
    },
];

export const metadata: Metadata = {
    title: `Documentation - ${SITE_NAME}`,
    description:
        'Learn OmniGrid concepts, in-app terms, quickstart workflow, architecture baseline, security model, and feature guides for Zero Trust server operations.',
    alternates: {
        canonical: absoluteUrl('/docs'),
    },
    openGraph: {
        title: `Documentation - ${SITE_NAME}`,
        description: SITE_DESCRIPTION,
        url: absoluteUrl('/docs'),
    },
};

export default function DocsPage() {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: `${SITE_NAME} documentation`,
        description:
            'Operator documentation for OmniGrid concepts, architecture, quickstart, security model, and feature guides.',
        url: absoluteUrl('/docs'),
        publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            logo: {
                '@type': 'ImageObject',
                url: absoluteUrl('/logo.png'),
            },
        },
    };

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-50">
            <script
                type="application/ld+json"
                suppressHydrationWarning
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(structuredData),
                }}
            />
            <header className="border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur sm:px-8 lg:px-10">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
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
                                Operator documentation
                            </div>
                        </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                        <Link
                            href="/"
                            className="inline-flex h-10 items-center rounded-md border border-white/12 px-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                        >
                            Landing
                        </Link>
                        <Link
                            href="/login"
                            className="inline-flex h-10 items-center rounded-md bg-lime-300 px-3 text-sm font-bold text-zinc-950 transition hover:bg-lime-200"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[16rem_1fr] lg:px-10">
                <aside className="hidden lg:block">
                    <div className="sticky top-6 border border-white/10 bg-white/[0.035] p-4">
                        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-zinc-500">
                            <FileText className="h-4 w-4" />
                            Docs
                        </div>
                        <nav className="flex flex-col gap-1">
                            {NAV_ITEMS.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="rounded-md px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </aside>

                <div className="min-w-0">
                    <section
                        id="start-here"
                        className="border border-white/10 bg-white/[0.035] p-6 sm:p-8"
                    >
                        <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-lime-300/10 px-3 py-2 text-sm font-bold text-lime-100">
                            <ShieldCheck className="h-4 w-4" />
                            Start here
                        </div>
                        <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-normal sm:text-5xl">
                            Learn OmniGrid from the operating model first.
                        </h1>
                        <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300">
                            OmniGrid Network Architecture is a Zero Trust server
                            operations standard. The app helps you prepare
                            hosts, store workspace-scoped secrets, open SSH
                            sessions, discover Docker workloads, inspect
                            topology, publish services, and monitor endpoints
                            from one control plane.
                        </p>
                        <div className="mt-7 grid gap-3 md:grid-cols-3">
                            <Principle
                                title="No open inbound ports"
                                body="Access goes through private networking, SSH from the control plane, and Zero Trust ingress."
                            />
                            <Principle
                                title="Secrets are scoped"
                                body="Platform secrets stay in env; customer-owned integration secrets live in encrypted workspace storage."
                            />
                            <Principle
                                title="Hosts follow a baseline"
                                body="Docker, omnigrid-net, and SSH access make nodes predictable enough to operate safely."
                            />
                        </div>
                    </section>

                    <section
                        id="mental-model"
                        className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"
                    >
                        <div className="border border-white/10 bg-zinc-900 p-6">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                                <Network className="h-4 w-4" />
                                Mental model
                            </div>
                            <h2 className="text-3xl font-black tracking-normal">
                                Think in three layers.
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-zinc-300">
                                OmniGrid separates the product into platform
                                runtime, workspace configuration, and managed
                                infrastructure. This keeps SaaS boundaries clear
                                while still giving operators a single cockpit.
                            </p>
                        </div>
                        <div className="grid gap-3">
                            <Layer
                                label="Platform"
                                title="Next.js control plane"
                                body="Auth, sessions, route handlers, Socket.IO SSH broker, SQLite storage, and encrypted vault runtime."
                            />
                            <Layer
                                label="Workspace"
                                title="Tenant-owned configuration"
                                body="Nodes, credential profiles, Tailscale settings, Cloudflare tokens, monitors, and audit records."
                            />
                            <Layer
                                label="Fleet"
                                title="Private infrastructure"
                                body="Linux hosts, Docker workloads, omnigrid-net, tailnet devices, tunnels, and published internal services."
                            />
                        </div>
                    </section>

                    <section id="terms" className="mt-10">
                        <SectionHeader
                            eyebrow="Core terms"
                            title="The in-app vocabulary"
                            body="These are the words operators see in OmniGrid. Understanding them makes the dashboard easier to reason about."
                        />
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            {TERMS.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <article
                                        key={item.term}
                                        className="border border-white/10 bg-white/[0.035] p-5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="grid h-10 w-10 place-items-center rounded-md bg-lime-300/10 text-lime-200">
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <h3 className="text-lg font-black">
                                                {item.term}
                                            </h3>
                                        </div>
                                        <p className="mt-4 text-sm leading-7 text-zinc-300">
                                            {item.definition}
                                        </p>
                                        <p className="mt-3 border-l-2 border-lime-300/40 pl-3 text-xs leading-6 text-zinc-500">
                                            {item.example}
                                        </p>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <section id="quickstart" className="mt-10">
                        <SectionHeader
                            eyebrow="Quickstart"
                            title="From empty repo to first managed node"
                            body="Use this path when you are setting up OmniGrid locally or preparing a new environment for testing."
                        />
                        <div className="mt-5 space-y-4">
                            {QUICKSTART_STEPS.map((step, index) => (
                                <article
                                    key={step.title}
                                    className="grid gap-4 border border-white/10 bg-zinc-900 p-5 lg:grid-cols-[13rem_1fr]"
                                >
                                    <div>
                                        <div className="text-sm font-black text-lime-200">
                                            0{index + 1}
                                        </div>
                                        <h3 className="mt-3 text-xl font-black">
                                            {step.title}
                                        </h3>
                                        <p className="mt-3 text-sm leading-6 text-zinc-400">
                                            {step.body}
                                        </p>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <span className="text-xs font-bold uppercase text-zinc-500">
                                                Command or path
                                            </span>
                                            {step.code === BOOTSTRAP_CMD && (
                                                <CopyCommandButton
                                                    command={BOOTSTRAP_CMD}
                                                />
                                            )}
                                        </div>
                                        <pre className="overflow-x-auto rounded-md bg-black/60 p-4 text-xs leading-6 text-zinc-100 ring-1 ring-white/10">
                                            <code>{step.code}</code>
                                        </pre>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section id="architecture" className="mt-10">
                        <SectionHeader
                            eyebrow="Architecture"
                            title="What OmniGrid expects from your infrastructure"
                            body="The architecture is intentionally opinionated so the control plane can operate private infrastructure without turning every host into a public endpoint."
                        />
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            <TeachingCard
                                icon={<Server className="h-5 w-5" />}
                                title="Managed hosts"
                                body="Each managed host should run Docker, accept SSH from the control plane, and join the shared external network named omnigrid-net."
                            />
                            <TeachingCard
                                icon={<TerminalSquare className="h-5 w-5" />}
                                title="SSH broker"
                                body="OmniGrid opens SSH sessions on the backend. The browser receives terminal data, not credential material."
                            />
                            <TeachingCard
                                icon={<Boxes className="h-5 w-5" />}
                                title="Container discovery"
                                body="Container visibility comes from docker ps over SSH. omnigrid-net acts as the boundary for workloads OmniGrid should care about."
                            />
                            <TeachingCard
                                icon={<Cloud className="h-5 w-5" />}
                                title="Zero Trust exposure"
                                body="Cloudflare Tunnel or another Zero Trust ingress publishes apps while managed hosts keep inbound ports closed."
                            />
                        </div>
                    </section>

                    <section id="features" className="mt-10">
                        <SectionHeader
                            eyebrow="Feature guides"
                            title="How to read the main app sections"
                            body="Each section in OmniGrid maps to a specific operator job. Treat these as product docs for the current dashboard."
                        />
                        <div className="mt-5 grid gap-3 lg:grid-cols-2">
                            {FEATURE_GUIDES.map((feature) => {
                                const Icon = feature.icon;
                                return (
                                    <article
                                        key={feature.title}
                                        className="border border-white/10 bg-white/[0.035] p-5"
                                    >
                                        <Icon className="h-5 w-5 text-cyan-200" />
                                        <h3 className="mt-4 text-xl font-black">
                                            {feature.title}
                                        </h3>
                                        <p className="mt-3 text-sm leading-7 text-zinc-300">
                                            {feature.body}
                                        </p>
                                        <p className="mt-3 rounded-md bg-black/35 p-3 text-xs leading-6 text-zinc-400">
                                            {feature.learn}
                                        </p>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <section
                        id="security"
                        className="mt-10 border border-white/10 bg-zinc-900 p-6"
                    >
                        <SectionHeader
                            eyebrow="Security model"
                            title="What belongs in env, and what belongs in a workspace"
                            body="This distinction matters because OmniGrid is moving toward public SaaS usage. Platform-owned secrets and customer-owned secrets cannot be treated the same way."
                        />
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            <Policy
                                title="Platform environment"
                                items={[
                                    'OMNIGRID_MASTER_KEY',
                                    'OMNIGRID_PUBLIC_URL',
                                    'OMNIGRID_DB_PATH',
                                    'OAuth app client secrets owned by the platform',
                                ]}
                            />
                            <Policy
                                title="Workspace encrypted settings"
                                items={[
                                    'Tailscale API key and tailnet',
                                    'Cloudflare Account ID and API token',
                                    'SSH credential profiles',
                                    'Webhook URLs and external integration tokens',
                                ]}
                            />
                        </div>
                    </section>

                    <section
                        id="production"
                        className="mt-10 border border-lime-300/20 bg-lime-300/10 p-6"
                    >
                        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                            <div>
                                <div className="text-sm font-bold uppercase text-lime-100">
                                    Production notes
                                </div>
                                <h2 className="mt-2 text-2xl font-black tracking-normal">
                                    Deploy the control plane behind private access.
                                </h2>
                                <p className="mt-3 max-w-3xl text-sm leading-7 text-lime-50/80">
                                    Keep OMNIGRID_PUBLIC_URL aligned with the
                                    real public origin, expose OmniGrid through
                                    Cloudflare Tunnel or another trusted ingress,
                                    and rotate workspace integration tokens from
                                    Settings when access changes.
                                </p>
                            </div>
                            <Link
                                href="/login"
                                className="inline-flex h-12 w-fit shrink-0 items-center gap-2 rounded-md bg-lime-300 px-5 text-sm font-black text-zinc-950 transition hover:bg-lime-200"
                            >
                                Open dashboard
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

function SectionHeader({
    eyebrow,
    title,
    body,
}: {
    eyebrow: string;
    title: string;
    body: string;
}) {
    return (
        <div>
            <div className="text-sm font-bold uppercase text-lime-200">
                {eyebrow}
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-normal">
                {title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
                {body}
            </p>
        </div>
    );
}

function Principle({ title, body }: { title: string; body: string }) {
    return (
        <div className="border border-white/10 bg-black/25 p-4">
            <h3 className="font-black">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
        </div>
    );
}

function Layer({
    label,
    title,
    body,
}: {
    label: string;
    title: string;
    body: string;
}) {
    return (
        <article className="border border-white/10 bg-white/[0.035] p-5">
            <div className="text-xs font-black uppercase text-cyan-200">
                {label}
            </div>
            <h3 className="mt-2 text-xl font-black">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
        </article>
    );
}

function TeachingCard({
    icon,
    title,
    body,
}: {
    icon: React.ReactNode;
    title: string;
    body: string;
}) {
    return (
        <article className="border border-white/10 bg-white/[0.035] p-5">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-cyan-300/10 text-cyan-200">
                {icon}
            </div>
            <h3 className="mt-4 text-lg font-black">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-zinc-300">{body}</p>
        </article>
    );
}

function Policy({ title, items }: { title: string; items: string[] }) {
    return (
        <article className="border border-white/10 bg-black/25 p-5">
            <div className="mb-4 flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-lime-200" />
                <h3 className="font-black">{title}</h3>
            </div>
            <ul className="space-y-2">
                {items.map((item) => (
                    <li
                        key={item}
                        className="flex gap-2 text-sm leading-6 text-zinc-300"
                    >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-300" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </article>
    );
}
