'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Network,
    Server,
    Terminal,
    Globe,
    Activity,
    ScrollText,
    PlayCircle,
    Power,
    Sparkles,
    LogOut,
    KeyRound,
    ShieldCheck,
    Settings,
    Boxes,
    Building2,
    Check,
    ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    soon?: boolean;
};

type AppShellUser = {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
};

const NAV: NavItem[] = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/topology', label: 'Topology', icon: Network },
    { href: '/nodes', label: 'Nodes', icon: Server },
    { href: '/credentials', label: 'Credentials', icon: KeyRound },
    { href: '/terminal', label: 'Terminal', icon: Terminal },
    { href: '/containers', label: 'Containers', icon: Boxes },
    { href: '/tunnels', label: 'Cloudflare Tunnel', icon: Globe },
    { href: '/uptime', label: 'Uptime', icon: Activity },
    { href: '/runbooks', label: 'Runbooks', icon: PlayCircle },
    { href: '/audit', label: 'Audit Log', icon: ScrollText },
    { href: '/wol', label: 'Wake-on-LAN', icon: Power },
];

const BOTTOM_NAV: NavItem[] = [
    { href: '/settings', label: 'Settings', icon: Settings },
];

interface AppShellProps {
    children: React.ReactNode;
    user?: AppShellUser | null;
}

export function AppShell({ children, user }: AppShellProps) {
    const pathname = usePathname();
    const [currentUser, setCurrentUser] = useState<AppShellUser | null>(
        user ?? null
    );
    const [checkingSession, setCheckingSession] = useState(false);
    const [sessionChecked, setSessionChecked] = useState(Boolean(user));
    const publicRoute =
        pathname === '/login' ||
        pathname?.startsWith('/auth/') ||
        pathname?.startsWith('/invitations/') ||
        pathname === '/' ||
        pathname === '/privacy-policy' ||
        pathname === '/terms' ||
        pathname === '/docs';

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            setCurrentUser(user ?? null);
            setSessionChecked(Boolean(user));
        });
        return () => {
            cancelled = true;
        };
    }, [user]);

    useEffect(() => {
        if (publicRoute || currentUser || sessionChecked) return;

        let cancelled = false;

        async function refreshSession() {
            try {
                const res = await fetch('/api/auth/session', {
                    cache: 'no-store',
                });
                if (!res.ok || cancelled) return;
                const data = (await res.json()) as {
                    authenticated?: boolean;
                    user?: AppShellUser | null;
                };
                if (data.authenticated && data.user) {
                    setCurrentUser(data.user);
                }
            } finally {
                if (!cancelled) {
                    setCheckingSession(false);
                    setSessionChecked(true);
                }
            }
        }

        queueMicrotask(() => {
            if (cancelled) return;
            setCheckingSession(true);
            void refreshSession();
        });

        return () => {
            cancelled = true;
        };
    }, [currentUser, publicRoute, sessionChecked]);

    if (publicRoute) {
        return <>{children}</>;
    }

    if (!currentUser && (checkingSession || !sessionChecked)) {
        return <SessionRefreshScreen />;
    }

    if (!currentUser) {
        return <AccessRequired />;
    }

    return (
        <div className="flex h-screen overflow-hidden text-foreground">
            <aside className="relative m-3 mr-0 flex w-64 shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-sidebar/80 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-cyan-400/15 to-transparent" />
                <div className="relative flex h-20 items-center gap-3 border-b border-white/10 px-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-white/10 to-white/5 shadow-lg shadow-cyan-500/10 ring-1 ring-white/10">
                        <Image
                            src="/logo.svg"
                            alt="OmniGrid Network Architecture"
                            width={28}
                            height={28}
                            className="drop-shadow-md"
                        />
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-bold tracking-tight">
                            OmniGrid Network Architecture
                        </span>
                        <span className="text-[11px] text-cyan-100/60">
                            Zero Trust server operations
                        </span>
                    </div>
                </div>
                <nav className="relative flex flex-col gap-1 p-3">
                    {NAV.map((item) => {
                        const active =
                            item.href === '/'
                                ? pathname === '/'
                                : pathname?.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200',
                                    active
                                        ? 'bg-gradient-to-r from-cyan-400/20 to-emerald-400/10 text-white shadow-inner ring-1 ring-cyan-300/20'
                                        : 'text-sidebar-foreground/55 hover:bg-white/5 hover:text-white',
                                    item.soon && 'opacity-50'
                                )}
                            >
                                <span
                                    className={cn(
                                        'grid h-8 w-8 place-items-center rounded-xl transition-colors',
                                        active
                                            ? 'bg-cyan-300/15 text-cyan-200'
                                            : 'bg-white/[0.03] text-sidebar-foreground/45 group-hover:text-cyan-200'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="flex-1">{item.label}</span>
                                {item.soon && (
                                    <span className="text-[10px] text-muted-foreground">
                                        soon
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="relative mt-auto p-3">
                    <WorkspaceSwitcher />
                    <div className="mb-3 flex flex-col gap-1 border-b border-white/10 pb-3">
                        {BOTTOM_NAV.map((item) => {
                            const active = pathname?.startsWith(item.href);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200',
                                        active
                                            ? 'bg-gradient-to-r from-cyan-400/20 to-emerald-400/10 text-white shadow-inner ring-1 ring-cyan-300/20'
                                            : 'text-sidebar-foreground/55 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'grid h-8 w-8 place-items-center rounded-xl transition-colors',
                                            active
                                                ? 'bg-cyan-300/15 text-cyan-200'
                                                : 'bg-white/[0.03] text-sidebar-foreground/45 group-hover:text-cyan-200'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="flex-1">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                    {currentUser ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <div className="flex items-center gap-3">
                                {currentUser.avatarUrl ? (
                                    <Image
                                        src={currentUser.avatarUrl}
                                        alt={currentUser.username}
                                        width={36}
                                        height={36}
                                        unoptimized
                                        className="h-9 w-9 rounded-xl ring-1 ring-white/10"
                                    />
                                ) : (
                                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/15 text-xs font-bold text-cyan-200">
                                        {currentUser.username
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>
                                )}
                                <div className="flex flex-1 flex-col truncate leading-tight">
                                    <span className="truncate text-sm font-medium">
                                        {currentUser.displayName ||
                                            currentUser.username}
                                    </span>
                                    <span className="truncate text-[11px] text-muted-foreground">
                                        @{currentUser.username}
                                    </span>
                                </div>
                                <LogoutButton />
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-3 text-xs text-emerald-50/80">
                            <div className="mb-1 flex items-center gap-2 font-medium text-emerald-100">
                                <Sparkles className="h-3.5 w-3.5" />
                                Tailscale-first
                            </div>
                            Secure control plane for SSH, topology, proxy, and
                            runbooks.
                        </div>
                    )}
                </div>
            </aside>
            <main className="m-3 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-2xl shadow-black/20 backdrop-blur-xl">
                <div className="h-full overflow-auto">{children}</div>
            </main>
        </div>
    );
}

type WorkspaceSummary = {
    id: string;
    name: string;
    slug: string;
    role: 'owner' | 'admin' | 'operator' | 'viewer';
};

function WorkspaceSwitcher() {
    const pathname = usePathname();
    const router = useRouter();
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function loadWorkspaces() {
            const response = await fetch('/api/workspaces', { cache: 'no-store' });
            if (!response.ok || cancelled) return;
            const data = (await response.json()) as { activeWorkspaceId: string; workspaces: WorkspaceSummary[] };
            setWorkspaces(data.workspaces);
            setActiveWorkspaceId(data.activeWorkspaceId);
        }
        void loadWorkspaces();
        return () => { cancelled = true; };
    }, []);

    const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
    if (!activeWorkspace) return null;

    async function switchWorkspace(workspace: WorkspaceSummary) {
        if (workspace.id === activeWorkspaceId || switching) return;
        setSwitching(true);
        try {
            const response = await fetch('/api/workspaces', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: workspace.id }),
            });
            if (!response.ok) return;
            setActiveWorkspaceId(workspace.id);
            router.replace(pathname || '/dashboard');
            router.refresh();
        } finally {
            setSwitching(false);
        }
    }

    return (
        <div className="mb-3 border-b border-white/10 pb-3">
            <DropdownMenu>
                <DropdownMenuTrigger
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:bg-white/[0.08]"
                    disabled={switching}
                >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-300/15 text-cyan-100"><Building2 className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{activeWorkspace.name}</span>
                        <span className="block text-[11px] capitalize text-muted-foreground">{activeWorkspace.role}</span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60 border border-white/10 bg-slate-950 p-1 text-white" align="start">
                    <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
                    {workspaces.map((workspace) => (
                        <DropdownMenuItem key={workspace.id} onClick={() => void switchWorkspace(workspace)} className="min-h-11 cursor-pointer px-2 py-2">
                            <Building2 className="h-4 w-4 text-cyan-200" />
                            <span className="min-w-0 flex-1"><span className="block truncate">{workspace.name}</span><span className="block text-xs capitalize text-muted-foreground">{workspace.role}</span></span>
                            {workspace.id === activeWorkspaceId ? <Check className="h-4 w-4 text-emerald-200" /> : null}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className="relative overflow-hidden border-b border-white/10 px-8 py-7">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 via-transparent to-emerald-400/5" />
            <div className="relative flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-2">{actions}</div>
                )}
            </div>
        </div>
    );
}

function AccessRequired() {
    return (
        <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
            <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/30">
                <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                    <ShieldCheck className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold">Login required</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    OmniGrid Network Architecture dashboard, SSH, nodes,
                    credentials, and topology require an authenticated session.
                </p>
                <Link
                    href="/login"
                    className="mt-6 inline-flex rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                    Sign in to OmniGrid Network Architecture
                </Link>
            </div>
        </div>
    );
}

function SessionRefreshScreen() {
    return (
        <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
            <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/30">
                <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-cyan-200/20 border-t-cyan-200" />
                <h1 className="text-2xl font-bold">Restoring session</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Your login succeeded. OmniGrid Network Architecture is
                    refreshing the dashboard session.
                </p>
            </div>
        </div>
    );
}

function LogoutButton() {
    const [loading, setLoading] = React.useState(false);
    const router = useRouter();

    async function handleLogout() {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            const data = await res.json().catch(() => ({ displayName: '' }));
            router.push(`/auth/logout?name=${encodeURIComponent(data.displayName || '')}`);
        } catch {
            router.push('/auth/logout');
        }
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            title="Sign out"
        >
            {loading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
                <LogOut className="h-3.5 w-3.5" />
            )}
        </button>
    );
}
