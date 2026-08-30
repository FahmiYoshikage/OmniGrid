"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  Edit3,
  FileCode2,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Square,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface RunbookSummary {
  id: string;
  name: string;
  description: string | null;
  shell: string;
  created_at: number;
  updated_at: number;
}

interface RunbookDetail extends RunbookSummary {
  body: string;
}

interface NodeOption {
  id: string;
  name: string;
  hostname: string;
  ssh_mode: string;
}

type RunStatus = "connecting" | "running" | "cancelling" | "completed" | "cancelled" | "failed";

interface RunOutput {
  stream: "stdout" | "stderr";
  chunk: string;
}

interface ActiveRun {
  runId?: string;
  runbookId: string;
  runbookName: string;
  nodeId: string;
  nodeName: string;
  status: RunStatus;
  startedAt: number;
  output: RunOutput[];
  code?: number | null;
  signal?: string | null;
  reason?: string;
  error?: string;
}

interface RunAck {
  ok: boolean;
  runId?: string;
  startedAt?: number;
  error?: string;
}

interface RunStatusEvent {
  runId: string;
  nodeId: string;
  runbookId: string;
  status: "connecting" | "running";
  at: number;
}

interface RunOutputEvent {
  runId: string;
  stream: "stdout" | "stderr";
  chunk: string;
}

interface RunExitEvent {
  runId: string;
  code: number | null;
  signal: string | null;
  reason: string;
  at: number;
}

interface RunErrorEvent {
  runId?: string;
  message: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  shell: "bash",
  body: "#!/usr/bin/env bash\nset -euo pipefail\n\n",
};

export function RunbooksClient() {
  const [runbooks, setRunbooks] = useState<RunbookSummary[]>([]);
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodesLoading, setNodesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [runTarget, setRunTarget] = useState<RunbookSummary | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  async function loadRunbooks() {
    setLoading(true);
    try {
      const res = await fetch("/api/runbooks", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { runbooks: RunbookSummary[] };
      setRunbooks(data.runbooks);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load runbooks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetch("/api/runbooks", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ runbooks: RunbookSummary[] }>;
      })
      .then((data) => setRunbooks(data.runbooks))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to load runbooks"))
      .finally(() => setLoading(false));

    void fetch("/api/nodes", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ nodes: NodeOption[] }>;
      })
      .then((data) => setNodes(data.nodes))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to load nodes"))
      .finally(() => setNodesLoading(false));
  }, []);

  useEffect(() => {
    const socket = io("/ssh", {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    function onStatus(event: RunStatusEvent) {
      setActiveRun((current) => {
        if (!current) return current;
        const matchesPending = !current.runId
          && current.runbookId === event.runbookId
          && current.nodeId === event.nodeId;
        if (current.runId !== event.runId && !matchesPending) return current;
        return { ...current, runId: event.runId, status: event.status };
      });
    }

    function onOutput(event: RunOutputEvent) {
      setActiveRun((current) => {
        if (!current || current.runId !== event.runId) return current;
        const output = [...current.output, { stream: event.stream, chunk: event.chunk }];
        let size = output.reduce((total, item) => total + item.chunk.length, 0);
        while (size > 200_000 && output.length > 1) {
          size -= output.shift()!.chunk.length;
        }
        return { ...current, output };
      });
    }

    function onExit(event: RunExitEvent) {
      setActiveRun((current) => {
        if (!current || current.runId !== event.runId) return current;
        const status: RunStatus = event.reason === "user-cancel"
          ? "cancelled"
          : event.reason === "completed" && event.code === 0 && !event.signal
            ? "completed"
            : "failed";
        return {
          ...current,
          status,
          code: event.code,
          signal: event.signal,
          reason: event.reason,
        };
      });
    }

    function onError(event: RunErrorEvent) {
      setActiveRun((current) => {
        if (!current || (event.runId && current.runId && current.runId !== event.runId)) return current;
        return { ...current, runId: event.runId ?? current.runId, status: "failed", error: event.message };
      });
    }

    function onDisconnect() {
      setActiveRun((current) => current && isRunActive(current.status)
        ? { ...current, status: "failed", error: "Connection lost while the runbook was executing." }
        : current);
    }

    socket.on("runbook:status", onStatus);
    socket.on("runbook:output", onOutput);
    socket.on("runbook:exit", onExit);
    socket.on("runbook:error", onError);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", (error) => toast.error(`Runbook connection failed: ${error.message}`));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [activeRun?.output, activeRun?.status]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  async function openEdit(id: string) {
    try {
      const res = await fetch(`/api/runbooks/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { runbook: RunbookDetail };
      setEditingId(id);
      setForm({
        name: data.runbook.name,
        description: data.runbook.description ?? "",
        shell: data.runbook.shell,
        body: data.runbook.body,
      });
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open runbook");
    }
  }

  async function saveRunbook() {
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/runbooks/${editingId}` : "/api/runbooks", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          shell: form.shell || "bash",
          body: form.body,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save runbook");
      toast.success(editingId ? "Runbook updated" : "Runbook created");
      setOpen(false);
      await loadRunbooks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save runbook");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRunbook(id: string) {
    if (!confirm("Delete this runbook?")) return;
    try {
      const res = await fetch(`/api/runbooks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Runbook deleted");
      await loadRunbooks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete runbook");
    }
  }

  function openRunDialog(runbook: RunbookSummary) {
    setRunTarget(runbook);
    setSelectedNodeId("");
  }

  function startRunbook() {
    if (!runTarget || !selectedNodeId || (activeRun && isRunActive(activeRun.status))) return;
    const socket = socketRef.current;
    const node = nodes.find((item) => item.id === selectedNodeId);
    if (!socket || !node) return;

    const pending = {
      runbookId: runTarget.id,
      runbookName: runTarget.name,
      nodeId: node.id,
      nodeName: node.name,
      status: "connecting" as const,
      startedAt: Date.now(),
      output: [],
    };
    setActiveRun(pending);
    setRunTarget(null);

    socket.emit("runbook:run", { runbookId: pending.runbookId, nodeId: pending.nodeId }, (ack: RunAck) => {
      if (!ack.ok || !ack.runId) {
        const message = ack.error || "Failed to start runbook";
        setActiveRun((current) => current?.runbookId === pending.runbookId && current.nodeId === pending.nodeId
          ? { ...current, status: "failed", error: message }
          : current);
        toast.error(message);
        return;
      }
      setActiveRun((current) => current?.runbookId === pending.runbookId && current.nodeId === pending.nodeId
        ? { ...current, runId: ack.runId, startedAt: ack.startedAt ?? current.startedAt }
        : current);
    });
  }

  function cancelRun() {
    const socket = socketRef.current;
    if (!socket || !activeRun?.runId || !isRunActive(activeRun.status)) return;
    const runId = activeRun.runId;
    setActiveRun((current) => current?.runId === runId ? { ...current, status: "cancelling" } : current);
    socket.emit("runbook:cancel", { runId }, (ack: { ok: boolean }) => {
      if (!ack.ok) {
        toast.error("The runbook could not be cancelled");
        setActiveRun((current) => current?.runId === runId && current.status === "cancelling"
          ? { ...current, status: "running" }
          : current);
      }
    });
  }

  const filtered = runbooks.filter((runbook) => {
    const text = `${runbook.name} ${runbook.description ?? ""} ${runbook.shell}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const runInProgress = activeRun ? isRunActive(activeRun.status) : false;

  return (
    <div className="space-y-6 p-8">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.72fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileCode2 className="h-4 w-4 text-cyan-200" />
                Runbook library
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Store repeatable shell snippets and operational procedures encrypted per workspace.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New runbook
            </Button>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search runbooks..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
            <ShieldCheck className="h-4 w-4" />
            Workspace encrypted
          </div>
          <p className="mt-2 text-sm leading-6 text-emerald-50/75">
            Runbook bodies are encrypted at rest. The list view only exposes metadata; command bodies are revealed when opening a runbook.
          </p>
        </div>
      </div>

      {activeRun && (
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TerminalSquare className="h-4 w-4 text-cyan-300" />
                <h2 className="truncate text-sm font-semibold text-white">{activeRun.runbookName}</h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    activeRun.status === "completed" && "border-emerald-300/30 text-emerald-200",
                    activeRun.status === "failed" && "border-red-300/30 text-red-200",
                    activeRun.status === "cancelled" && "border-amber-300/30 text-amber-200",
                    isRunActive(activeRun.status) && "border-cyan-300/30 text-cyan-200",
                  )}
                >
                  {activeRun.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {activeRun.nodeName} · started {new Date(activeRun.startedAt).toLocaleString()}
                {activeRun.code !== undefined ? ` · exit ${activeRun.code ?? "none"}` : ""}
                {activeRun.signal ? ` · signal ${activeRun.signal}` : ""}
              </p>
            </div>
            {runInProgress && (
              <Button variant="outline" size="sm" onClick={cancelRun} disabled={!activeRun.runId || activeRun.status !== "running"}>
                {activeRun.status === "cancelling" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                {activeRun.status === "cancelling" ? "Cancelling" : "Cancel run"}
              </Button>
            )}
          </div>
          <div ref={outputRef} className="h-72 overflow-auto bg-black px-4 py-3 font-mono text-xs leading-5 text-zinc-200" aria-live="polite">
            {activeRun.output.length === 0 && !activeRun.error ? (
              <span className="text-zinc-500">
                {runInProgress ? "Waiting for output..." : "Runbook produced no output."}
              </span>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono">
                {activeRun.output.map((item, index) => (
                  <span key={index} className={item.stream === "stderr" ? "text-red-300" : undefined}>{item.chunk}</span>
                ))}
              </pre>
            )}
            {activeRun.error && <div className="mt-2 whitespace-pre-wrap text-red-300">[error] {activeRun.error}</div>}
            {activeRun.reason && <div className="mt-2 text-zinc-500">[process exited: {activeRun.reason}]</div>}
          </div>
        </section>
      )}

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-muted-foreground">
          Loading runbooks...
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-3xl border border-white/10 bg-black/20 p-6 text-center">
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
              <FileCode2 className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">
              {runbooks.length ? "No matching runbooks" : "No runbooks yet"}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Create your first runbook for maintenance commands, incident checks, deployment notes, or recovery steps.
            </p>
            <Button className="mt-5" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New runbook
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((runbook) => (
            <article key={runbook.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-white">{runbook.name}</h2>
                    <Badge variant="secondary">{runbook.shell}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {runbook.description || "No description provided."}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => openRunDialog(runbook)} disabled={runInProgress} title={runInProgress ? "Another runbook is executing" : `Run ${runbook.name}`}>
                    <Play className="h-4 w-4" />
                    Run
                  </Button>
                  <Button variant="outline" size="icon-sm" onClick={() => void openEdit(runbook.id)} title="Edit runbook">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon-sm" onClick={() => void deleteRunbook(runbook.id)} title="Delete runbook">
                    <Trash2 className="h-4 w-4 text-red-200" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Created {new Date(runbook.created_at).toLocaleString()}</span>
                <span>Updated {new Date(runbook.updated_at).toLocaleString()}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit runbook" : "New runbook"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-[1fr_10rem]">
              <div className="space-y-2">
                <Label htmlFor="runbookName">Name</Label>
                <Input
                  id="runbookName"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Restart application containers"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="runbookShell">Shell</Label>
                <Input
                  id="runbookShell"
                  value={form.shell}
                  onChange={(event) => setForm((current) => ({ ...current, shell: event.target.value }))}
                  placeholder="bash"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="runbookDescription">Description</Label>
              <Input
                id="runbookDescription"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="What this runbook is for"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="runbookBody">Body</Label>
              <Textarea
                id="runbookBody"
                value={form.body}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                className="min-h-80 font-mono text-sm"
                spellCheck={false}
                disabled={saving}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Store command snippets and procedures here. Runs require explicit target selection and are recorded in the workspace audit log.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveRunbook} disabled={saving || !form.name.trim() || !form.body.trim()}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save runbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!runTarget} onOpenChange={(nextOpen) => !nextOpen && setRunTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Run {runTarget?.name}</DialogTitle>
            <DialogDescription>
              Select the target node and confirm execution. The runbook will execute immediately over SSH.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="runbookTarget">Target node</Label>
            <Select value={selectedNodeId} onValueChange={(value) => setSelectedNodeId(value ?? "")} disabled={nodesLoading}>
              <SelectTrigger id="runbookTarget" className="w-full">
                <SelectValue placeholder={nodesLoading ? "Loading nodes..." : "Select a node"} />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.name} <span className="text-muted-foreground">{node.hostname} · {node.ssh_mode}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!nodesLoading && nodes.length === 0 && (
              <p className="text-xs text-amber-200">No workspace nodes are available. Add a node before running this runbook.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunTarget(null)}>Cancel</Button>
            <Button onClick={startRunbook} disabled={!selectedNodeId || nodesLoading || runInProgress}>
              <Play className="h-4 w-4" />
              Confirm and run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isRunActive(status: RunStatus): boolean {
  return status === "connecting" || status === "running" || status === "cancelling";
}
