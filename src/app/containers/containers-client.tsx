'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/app-shell';
import { cn } from '@/lib/utils';
import {
    Activity,
    Boxes,
    ExternalLink,
    RefreshCw,
    Search,
    Server,
    Settings,
    ShieldCheck,
    Wifi,
} from 'lucide-react';

type TailnetSnapshot = {
    devices: Array<{
        id: string;
        name: string;
        shortName: string;
        hostname: string;
        os: string;
        tailscaleIp: string;
        lastSeen: number;
        online: boolean;
    }>;
    fetchedAt: number;
} | null;

type ContainerEntry = {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    ports: string;
    source: string;
};

interface ContainersClientProps {
    snapshot: TailnetSnapshot;
}

export function ContainersClient({ snapshot }: ContainersClientProps) {
    const [containers, setContainers] = useState<ContainerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [hostFilter, setHostFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    async function fetchContainers(showSpinner = true) {
        if (showSpinner) setScanning(true);
        setError(null);
        try {
            const res = await fetch('/api/uptime/discover', {
                cache: 'no-store',
            });
            const data = (await res.json().catch(() => ({}))) as {
                containers?: ContainerEntry[];
                error?: string;
            };
            if (!res.ok) {
                throw new Error(
                    data.error || 'Failed to scan docker containers'
                );
            }
            setContainers(data.containers ?? []);
            setLastRefreshed(new Date());
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : 'Failed to scan docker containers';
            setError(message);
            setContainers([]);
        } finally {
            setLoading(false);
            if (showSpinner) setScanning(false);
        }
    }

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) void fetchContainers(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const deviceSummary = useMemo(() => {
        const total = snapshot?.devices.length ?? 0;
        const online =
            snapshot?.devices.filter((device) => device.online).length ?? 0;
        return { total, online, offline: Math.max(total - online, 0) };
    }, [snapshot]);

    const hosts = useMemo(() => {
        const unique = new Set(containers.map((c) => c.source));
        return [
            'all',
            ...Array.from(unique).sort((a, b) => a.localeCompare(b)),
        ];
    }, [containers]);

    const filtered = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const base = containers.filter(
            (container) =>
                hostFilter === 'all' || container.source === hostFilter
        );
        const searched = normalizedQuery
            ? base.filter((container) =>
                  [container.name, container.image, container.source].some(
                      (value) => value?.toLowerCase().includes(normalizedQuery)
                  )
              )
            : base;
        return searched.sort((a, b) => {
            const hostCompare = a.source.localeCompare(b.source);
            if (hostCompare !== 0) return hostCompare;
            return a.name.localeCompare(b.name);
        });
    }, [containers, hostFilter, query]);

    const containerSummary = useMemo(() => {
        const total = containers.length;
        const running = containers.filter((c) => c.state === 'running').length;
        const exited = total - running;
        return { total, running, exited };
    }, [containers]);

    return (
        <div className="flex min-h-full flex-col">
            <PageHeader
                title="Fleet Containers"
                description="Monitor all containers running inside your OmniGrid Network Architecture without opening SSH sessions."
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        {lastRefreshed ? (
                            <span className="text-xs text-muted-foreground">
                                Updated {lastRefreshed.toLocaleTimeString()}
                            </span>
                        ) : null}
                        <button
                            onClick={() => void fetchContainers(true)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                        >
                            <RefreshCw
                                className={cn(
                                    'h-4 w-4',
                                    scanning && 'animate-spin'
                                )}
                            />{' '}
                            Scan Docker
                        </button>
                        <Link
                            href="/uptime"
                            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                        >
                            <Activity className="h-4 w-4" /> Add monitor
                        </Link>
                    </div>
                }
            />

            <div className="grid grid-cols-1 gap-4 p-8 xl:grid-cols-[1.2fr_1fr]">
                <Card className="border-white/10 bg-gradient-to-br from-cyan-400/10 via-black/40 to-emerald-400/5 shadow-2xl shadow-black/10">
                    <CardHeader className="flex-row items-start justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ShieldCheck className="h-4 w-4 text-cyan-200" />{' '}
                                Tailscale fleet status
                            </CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Live snapshot of every device connected to your
                                tailnet.
                            </p>
                        </div>
                        {snapshot ? (
                            <Badge variant="secondary">
                                {deviceSummary.online}/{deviceSummary.total}{' '}
                                online
                            </Badge>
                        ) : (
                            <Badge variant="outline">Not configured</Badge>
                        )}
                    </CardHeader>
                    <CardContent>
                        {!snapshot ? (
                            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
                                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                                    <Settings className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        Tailscale integration not configured
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Add your Tailscale API key and tailnet
                                        in Settings to see fleet status here.
                                    </p>
                                </div>
                                <Link
                                    href="/settings"
                                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300/15 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/25"
                                >
                                    <Settings className="h-3 w-3" /> Configure
                                    Tailscale
                                </Link>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {snapshot.devices.map((device) => (
                                    <div
                                        key={device.id}
                                        className="rounded-2xl border border-white/10 bg-black/30 p-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={cn(
                                                    'h-2.5 w-2.5 rounded-full',
                                                    device.online
                                                        ? 'bg-emerald-500 shadow-emerald-500/50'
                                                        : 'bg-zinc-500'
                                                )}
                                            />
                                            <span className="text-sm font-medium text-white truncate">
                                                {device.shortName}
                                            </span>
                                            {device.online ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="ml-auto text-[10px]"
                                                >
                                                    Online
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="ml-auto text-[10px]"
                                                >
                                                    Offline
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                                            <div className="flex items-center justify-between">
                                                <span>IP</span>
                                                <span className="font-mono text-white/80">
                                                    {device.tailscaleIp || '-'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>OS</span>
                                                <span className="text-white/70">
                                                    {device.os || 'Unknown'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Last seen</span>
                                                <span className="text-white/70">
                                                    {device.lastSeen
                                                        ? new Date(
                                                              device.lastSeen
                                                          ).toLocaleString()
                                                        : '-'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
                    <CardHeader className="flex-row items-start justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Boxes className="h-4 w-4 text-emerald-200" />{' '}
                                Container overview
                            </CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Docker containers discovered across every node
                                connected to omnigrid-net.
                            </p>
                        </div>
                        <Badge variant="secondary">
                            {containerSummary.running}/{containerSummary.total}{' '}
                            running
                        </Badge>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-3">
                        <SummaryTile
                            label="Total containers"
                            value={String(containerSummary.total)}
                            icon={<Boxes className="h-4 w-4" />}
                        />
                        <SummaryTile
                            label="Running"
                            value={String(containerSummary.running)}
                            icon={<Wifi className="h-4 w-4" />}
                        />
                        <SummaryTile
                            label="Stopped"
                            value={String(containerSummary.exited)}
                            icon={<Server className="h-4 w-4" />}
                        />
                    </CardContent>
                </Card>
            </div>

            <div className="px-8 pb-8">
                <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Boxes className="h-4 w-4 text-cyan-200" />{' '}
                                Containers
                            </CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Filter by host, search by name or image, and
                                create monitors for anything in or outside the
                                tailnet.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    placeholder="Search containers or images"
                                    className="h-7 w-44 border-none bg-transparent p-0 text-xs text-white placeholder-zinc-500 focus-visible:ring-0"
                                />
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-muted-foreground">
                                <span>Host</span>
                                <select
                                    value={hostFilter}
                                    onChange={(event) =>
                                        setHostFilter(event.target.value)
                                    }
                                    className="rounded bg-transparent text-xs text-white outline-none"
                                >
                                    {hosts.map((host) => (
                                        <option
                                            key={host}
                                            value={host}
                                            className="bg-slate-900 text-white"
                                        >
                                            {host === 'all'
                                                ? 'All hosts'
                                                : host}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Link
                                href="/uptime"
                                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15"
                            >
                                <ExternalLink className="h-3 w-3" /> New monitor
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                                Scanning containers...
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-200">
                                <span>{error}</span>
                                <button
                                    onClick={() => void fetchContainers(true)}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-red-500/20 px-4 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/30"
                                >
                                    <RefreshCw className="h-3 w-3" /> Retry scan
                                </button>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
                                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                                    <Boxes className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        No containers found
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Ensure your services run on the
                                        omnigrid-net Docker network or refresh
                                        the scan.
                                    </p>
                                </div>
                                <button
                                    onClick={() => void fetchContainers(true)}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300/15 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/25"
                                >
                                    <RefreshCw className="h-3 w-3" /> Scan again
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-separate border-spacing-y-2 text-left text-xs">
                                    <thead className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                        <tr>
                                            <th className="px-3">Container</th>
                                            <th className="px-3">Host</th>
                                            <th className="px-3">Image</th>
                                            <th className="px-3">Status</th>
                                            <th className="px-3">Ports</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((container) => {
                                            const running =
                                                container.state === 'running';
                                            return (
                                                <tr
                                                    key={container.id}
                                                    className="rounded-2xl bg-black/30"
                                                >
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={cn(
                                                                    'h-2.5 w-2.5 rounded-full',
                                                                    running
                                                                        ? 'bg-emerald-500 shadow-emerald-500/50'
                                                                        : 'bg-zinc-600'
                                                                )}
                                                            />
                                                            <div>
                                                                <div className="font-medium text-white">
                                                                    {
                                                                        container.name
                                                                    }
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    {container.id.slice(
                                                                        0,
                                                                        12
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-white/80">
                                                        {container.source}
                                                    </td>
                                                    <td className="px-3 py-3 text-white/70">
                                                        {container.image}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span
                                                            className={cn(
                                                                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]',
                                                                running
                                                                    ? 'bg-emerald-500/15 text-emerald-300'
                                                                    : 'bg-zinc-500/15 text-zinc-300'
                                                            )}
                                                        >
                                                            {container.status ||
                                                                container.state}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-white/70">
                                                        {container.ports || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function SummaryTile({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {label}
                </span>
                <span className="text-emerald-200">{icon}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
                {value}
            </div>
        </div>
    );
}
