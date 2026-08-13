"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Edit3, ExternalLink, KeyRound, Plus, RefreshCw, Server, Shield, Tags, Terminal, Trash2, Wifi } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { cn } from "@/lib/utils";
import type { NodeRow, SshMode } from "@/lib/db/repos/nodes";

type CredentialKind = "ssh_key" | "password";

interface CredentialPublic {
  id: string;
  label: string;
  kind: CredentialKind;
  has_passphrase: boolean;
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NodeRow | null>(null);

  const stats = useMemo(() => {
    const tags = new Set<string>();
    for (const n of nodes) parseTags(n.tags).forEach((tag) => tags.add(tag));
    return {
      total: nodes.length,
      tailscale: nodes.filter((n) => n.ssh_mode === "tailscale").length,
      tagged: tags.size,
    };
  }, [nodes]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/nodes");
    const data = await res.json();
    setNodes(data.nodes ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this node?")) return;
    const res = await fetch(`/api/nodes/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Node deleted");
      load();
    } else toast.error("Delete failed");
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Nodes"
        description="Inventory command center for servers, VPS, and Tailscale devices. Manage SSH target metadata before opening terminals or drawing topology."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-white/10 bg-white/5">
              <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add node
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard icon={Server} label="Managed nodes" value={stats.total} tone="cyan" />
          <StatCard icon={Shield} label="Agent/default key" value={stats.tailscale} tone="emerald" />
          <StatCard icon={Tags} label="Unique tags" value={stats.tagged} tone="violet" />
        </div>

        {nodes.length === 0 && !loading ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03]">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <Server className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold">No nodes registered yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Add a VPS, Raspberry Pi, NAS, or any device reachable via Tailscale SSH.
              </p>
              <Button className="mt-5" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Add first node
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                onEdit={() => setEditing(node)}
                onDelete={() => remove(node.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <NodeDialog
          mode="create"
          onDone={() => {
            setOpen(false);
            load();
          }}
        />
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <NodeDialog
            mode="edit"
            node={editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "violet";
}) {
  const tones = {
    cyan: "from-cyan-400/20 to-cyan-400/5 text-cyan-200",
    emerald: "from-emerald-400/20 to-emerald-400/5 text-emerald-200",
    violet: "from-violet-400/20 to-violet-400/5 text-violet-200",
  };
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
        </div>
        <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  onEdit,
  onDelete,
}: {
  node: NodeRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tags = parseTags(node.tags);
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-5 shadow-2xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-cyan-950/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/15">
            <Server className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{node.name}</h2>
              <Badge variant="outline" className="border-emerald-300/20 bg-emerald-300/10 text-[11px] text-emerald-100">
                {node.ssh_mode}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-cyan-100/70">
              <Wifi className="h-3.5 w-3.5" />
              <span>{node.hostname}</span>
              <span className="text-muted-foreground">:{node.ssh_port}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} title="Edit node" className="hover:bg-cyan-300/10 hover:text-cyan-100">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Delete node" className="hover:bg-red-500/10">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <InfoPill label="OS" value={node.os || "unknown"} />
        <InfoPill label="SSH user" value={node.ssh_user || "default"} />
        <InfoPill label="Updated" value={new Date(node.updated_at).toLocaleDateString()} />
      </div>

      <div className="mt-4 flex min-h-7 flex-wrap gap-2">
        {tags.length > 0 ? tags.map((tag) => (
          <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-muted-foreground">
            #{tag}
          </span>
        )) : (
          <span className="text-xs text-muted-foreground">No tags assigned</span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <Link
          href={`/terminal?node=${node.id}`}
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-medium text-slate-950 transition-colors hover:bg-cyan-200"
        >
          <Terminal className="h-4 w-4" /> Open SSH
        </Link>
        <Link
          href={`/topology?focus=${node.id}`}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium transition-colors hover:bg-white/[0.06]"
        >
          <ExternalLink className="h-4 w-4" /> View topology
        </Link>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}

function NodeDialog({
  mode,
  node,
  onDone,
}: {
  mode: "create" | "edit";
  node?: NodeRow;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<CredentialPublic[]>([]);
  const [form, setForm] = useState({
    name: node?.name ?? "",
    hostname: node?.hostname ?? "",
    os: node?.os ?? "",
    ssh_user: node?.ssh_user ?? "",
    ssh_port: node?.ssh_port ?? 22,
    ssh_mode: (node?.ssh_mode ?? "tailscale") as SshMode,
    credential_id: node?.credential_id ?? "",
    auth_action: node?.credential_id ? "existing" : "new",
    credential_label: "",
    secret: "",
    passphrase: "",
    tags: parseTags(node?.tags ?? null).join(", "),
  });
  const matchingCredentials = credentials.filter((c) =>
    form.ssh_mode === "password" ? c.kind === "password" : c.kind === "ssh_key",
  );

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((data) => setCredentials(data.credentials ?? []))
      .catch(() => setCredentials([]));
  }, []);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    let credentialId = form.credential_id || null;
    const needsCredential = form.ssh_mode === "password" || form.ssh_mode === "key";
    if (needsCredential && form.auth_action === "new") {
      if (!form.secret) {
        setSubmitting(false);
        toast.error(form.ssh_mode === "password" ? "Password is required" : "Private key is required");
        return;
      }
      const credRes = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.credential_label || `${form.ssh_user || "ssh"}@${form.name || form.hostname}`,
          kind: form.ssh_mode === "password" ? "password" : "ssh_key",
          secret: form.secret,
          passphrase: form.passphrase || undefined,
        }),
      });
      if (!credRes.ok) {
        setSubmitting(false);
        const data = await credRes.json().catch(() => ({}));
        toast.error(data.error || "Failed to save password");
        return;
      }
      const data = await credRes.json();
      credentialId = data.credential.id;
    }
    if (needsCredential && !credentialId) {
      setSubmitting(false);
      toast.error("Select or create an authentication profile");
      return;
    }

    const payload = {
      name: form.name,
      hostname: form.hostname,
      os: form.os || null,
      ssh_user: form.ssh_user || null,
      ssh_port: form.ssh_port,
      ssh_mode: form.ssh_mode,
      credential_id: needsCredential ? credentialId : null,
      tags: form.tags
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined,
    };
    const res = await fetch(mode === "edit" && node ? `/api/nodes/${node.id}` : "/api/nodes", {
      method: mode === "edit" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success(mode === "edit" ? "Node updated" : "Node added");
      onDone();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Save failed");
    }
  }

  return (
    <DialogContent className="max-w-2xl border-white/10 bg-zinc-950/95 p-0 shadow-2xl shadow-black/40">
      <DialogHeader>
        <div className="border-b border-white/10 bg-gradient-to-r from-cyan-400/10 to-emerald-400/5 p-5">
          <DialogTitle className="text-lg">{mode === "edit" ? "Edit node" : "Add node"}</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "edit" ? "Update SSH target metadata and inventory tags." : "Register a new device for topology and web SSH."}
          </p>
        </div>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required className="h-10 bg-white/[0.04]" />
          </Field>
          <Field label="Hostname / Tailscale IP" required>
            <Input
              value={form.hostname}
              onChange={(e) => update("hostname", e.target.value)}
              placeholder="100.64.0.10 or mybox.tail-xxxx.ts.net"
              required
              className="h-10 bg-white/[0.04] font-mono"
            />
          </Field>
          <Field label="OS">
            <Input value={form.os} onChange={(e) => update("os", e.target.value)} placeholder="linux" className="h-10 bg-white/[0.04]" />
          </Field>
          <Field label="SSH mode">
            <Select
              value={form.ssh_mode}
              onValueChange={(v) => update("ssh_mode", v as SshMode)}
            >
              <SelectTrigger className="h-10 bg-white/[0.04]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tailscale">Use SSH agent/default key</SelectItem>
                <SelectItem value="password">Use password profile</SelectItem>
                <SelectItem value="key">Use private key profile</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="SSH user">
            <Input value={form.ssh_user} onChange={(e) => update("ssh_user", e.target.value)} placeholder="root" className="h-10 bg-white/[0.04]" />
          </Field>
          <Field label="SSH port">
            <Input
              type="number"
              value={form.ssh_port}
              onChange={(e) => update("ssh_port", Number(e.target.value))}
              className="h-10 bg-white/[0.04]"
            />
          </Field>
        </div>
        {form.ssh_mode !== "tailscale" && (
          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.03] p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Authentication profile</div>
                <p className="text-xs text-muted-foreground">
                  Save one password or private key once, then reuse it across many nodes.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Credential source">
                <Select value={form.auth_action} onValueChange={(v) => update("auth_action", v ?? "new")}>
                  <SelectTrigger className="h-10 bg-white/[0.04]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Use saved profile</SelectItem>
                    <SelectItem value="new">Create new profile</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.auth_action === "existing" ? (
                <Field label="Saved profile" required>
                  <Select value={form.credential_id} onValueChange={(v) => update("credential_id", v ?? "")}>
                    <SelectTrigger className="h-10 bg-white/[0.04]">
                      <SelectValue placeholder={matchingCredentials.length ? "Select credential…" : "No saved profiles"} />
                    </SelectTrigger>
                    <SelectContent>
                      {matchingCredentials.map((credential) => (
                        <SelectItem key={credential.id} value={credential.id}>
                          {credential.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field label="Profile label">
                  <Input
                    value={form.credential_label}
                    onChange={(e) => update("credential_label", e.target.value)}
                    placeholder={form.ssh_mode === "password" ? "username ssh" : "username ssh key"}
                    className="h-10 bg-white/[0.04]"
                  />
                </Field>
              )}
            </div>
            {form.auth_action === "new" && (
              <div className="mt-4 grid gap-4">
                <Field label={form.ssh_mode === "password" ? "SSH password" : "Private key"} required>
                  {form.ssh_mode === "password" ? (
                    <Input
                      type="password"
                      value={form.secret}
                      onChange={(e) => update("secret", e.target.value)}
                      placeholder="Password for SSH login"
                      className="h-10 bg-white/[0.04]"
                      required
                    />
                  ) : (
                    <textarea
                      value={form.secret}
                      onChange={(e) => update("secret", e.target.value)}
                      placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\\n..."}
                      required
                      className="min-h-40 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-cyan-300/50"
                    />
                  )}
                </Field>
                {form.ssh_mode === "key" && (
                  <Field label="Private key passphrase">
                    <Input
                      type="password"
                      value={form.passphrase}
                      onChange={(e) => update("passphrase", e.target.value)}
                      placeholder="Optional"
                      className="h-10 bg-white/[0.04]"
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        )}
        <Field label="Tags (comma-separated)">
          <Input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="prod, vps" className="h-10 bg-white/[0.04]" />
        </Field>
        <DialogFooter className="mx-0 mb-0 rounded-2xl border-white/10 bg-white/[0.03]">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : mode === "edit" ? "Update node" : "Save node"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
