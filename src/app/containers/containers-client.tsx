'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/app-shell';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Activity,
    Boxes,
    Check,
    Copy,
    ExternalLink,
    Play,
    RefreshCw,
    RotateCw,
    Search,
    Server,
    Settings,
    ShieldCheck,
    Square,
    Terminal,
    Wifi,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

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
    nodeId?: string;
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
    const [actionLoading, setActionLoading] = useState<Record<string, 'start' | 'stop' | 'restart' | null>>({});
    const [activeLogContainer, setActiveLogContainer] = useState<ContainerEntry | null>(null);
    const [logs, setLogs] = useState<string>('');
    const [logsLoading, setLogsLoading] = useState(false);
    const [copiedLogs, setCopiedLogs] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        container: ContainerEntry;
        action: 'start' | 'stop' | 'restart';
    } | null>(null);

    async function executeAction(container: ContainerEntry, action: 'start' | 'stop' | 'restart') {
        setActionLoading((prev) => ({ ...prev, [container.id]: action }));
        try {
            const res = await fetch(`/api/containers/${encodeURIComponent(container.id)}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeId: container.nodeId || '__local__',
                    action,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            if (!res.ok || !data.ok) {
                throw new Error(data.error || `Failed to ${action} container`);
            }
            toast.success(`Container ${container.name} ${action}ed successfully`);
            await fetchContainers(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : `Failed to ${action} container`);
        } finally {
            setActionLoading((prev) => ({ ...prev, [container.id]: null }));
            setConfirmAction(null);
        }
    }

    async function fetchLogs(container: ContainerEntry) {
        setActiveLogContainer(container);
        setLogsLoading(true);
        setLogs('');
        try {
            const nodeId = container.nodeId || '__local__';
            const res = await fetch(
                `/api/containers/${encodeURIComponent(container.id)}/logs?nodeId=${encodeURIComponent(nodeId)}&tail=200`
            );
            const data = (await res.json().catch(() => ({}))) as { logs?: string; error?: string };
            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch logs');
            }
            setLogs(data.logs || 'No logs found for this container.');
        } catch (err) {
            setLogs(`Error loading logs: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLogsLoading(false);
        }
    }

    function copyLogsToClipboard() {
        if (!logs) return;
        void navigator.clipboard.writeText(logs);
        setCopiedLogs(true);
        setTimeout(() => setCopiedLogs(false), 2000);
        toast.success('Logs copied to clipboard');
    }

    async function fetchContainers(showSpinner = true, force = false) {
        if (showSpinner) setScanning(true);
        setError(null);
        try {
            const url = `/api/uptime/discover${force ? '?refresh=true' : ''}`;
            const res = await fetch(url, {
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
                            onClick={() => void fetchContainers(true, true)}
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
                                            <th className="px-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((container) => {
                                            const running =
                                                container.state === 'running';
                                            const loadingAction = actionLoading[container.id];
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
                                                                <div className="text-[10px] text-muted-foreground font-mono">
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
                                                    <td className="px-3 py-3 text-white/70 font-mono text-[11px]">
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
                                                    <td className="px-3 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => void fetchLogs(container)}
                                                                title="View logs"
                                                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
                                                            >
                                                                <Terminal className="h-3 w-3 text-cyan-300" />
                                                                Logs
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmAction({ container, action: 'restart' })}
                                                                disabled={Boolean(loadingAction)}
                                                                title="Restart container"
                                                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-amber-300 transition hover:bg-white/10 disabled:opacity-50"
                                                            >
                                                                <RotateCw className={cn("h-3 w-3", loadingAction === 'restart' && "animate-spin")} />
                                                                Restart
                                                            </button>
                                                            {running ? (
                                                                <button
                                                                    onClick={() => setConfirmAction({ container, action: 'stop' })}
                                                                    disabled={Boolean(loadingAction)}
                                                                    title="Stop container"
                                                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 text-[11px] font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                                                                >
                                                                    <Square className={cn("h-3 w-3", loadingAction === 'stop' && "animate-pulse")} />
                                                                    Stop
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => void executeAction(container, 'start')}
                                                                    disabled={Boolean(loadingAction)}
                                                                    title="Start container"
                                                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                                                                >
                                                                    <Play className={cn("h-3 w-3", loadingAction === 'start' && "animate-pulse")} />
                                                                    Start
                                                                </button>
                                                            )}
                                                        </div>
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

            {/* Logs Dialog */}
            <Dialog open={Boolean(activeLogContainer)} onOpenChange={(open) => { if (!open) setActiveLogContainer(null); }}>
                <DialogContent className="max-w-3xl bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-3 pr-6">
                            <div className="flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-cyan-400" />
                                <DialogTitle className="text-base font-semibold">
                                    {activeLogContainer?.name} · Logs
                                </DialogTitle>
                                <span className="text-xs text-zinc-500 font-mono">({activeLogContainer?.id.slice(0, 12)})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={copyLogsToClipboard}
                                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
                                >
                                    {copiedLogs ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                                    {copiedLogs ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                    onClick={() => activeLogContainer && void fetchLogs(activeLogContainer)}
                                    disabled={logsLoading}
                                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", logsLoading && "animate-spin")} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="mt-2 max-h-[60vh] overflow-auto rounded-xl bg-black/80 p-4 font-mono text-xs text-zinc-200 border border-white/5 leading-relaxed">
                        {logsLoading ? (
                            <div className="flex items-center justify-center py-12 text-zinc-500">
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin text-cyan-400" />
                                Fetching live container logs...
                            </div>
                        ) : (
                            <pre className="whitespace-pre-wrap break-all">{logs || 'No output recorded.'}</pre>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Action Confirmation Dialog */}
            <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
                <DialogContent className="max-w-md bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">
                            Confirm Container Action
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-zinc-300 mt-2">
                        Are you sure you want to <strong className="text-white uppercase">{confirmAction?.action}</strong> container{' '}
                        <code className="text-cyan-300 font-mono">{confirmAction?.container.name}</code> on host{' '}
                        <strong className="text-white">{confirmAction?.container.source}</strong>?
                    </p>
                    <div className="mt-6 flex items-center justify-end gap-2">
                        <button
                            onClick={() => setConfirmAction(null)}
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => confirmAction && void executeAction(confirmAction.container, confirmAction.action)}
                            disabled={confirmAction ? Boolean(actionLoading[confirmAction.container.id]) : false}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg transition",
                                confirmAction?.action === 'stop' ? "bg-red-600 hover:bg-red-500" : "bg-amber-600 hover:bg-amber-500"
                            )}
                        >
                            {confirmAction?.action === 'restart' ? (
                                <RotateCw className="h-3.5 w-3.5" />
                            ) : confirmAction?.action === 'stop' ? (
                                <Square className="h-3.5 w-3.5" />
                            ) : (
                                <Play className="h-3.5 w-3.5" />
                            )}
                            Confirm {confirmAction?.action}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
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
