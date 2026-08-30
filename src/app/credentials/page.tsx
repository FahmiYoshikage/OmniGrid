"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Edit3, KeyRound, Plus, RefreshCw, Shield, Trash2 } from "lucide-react";
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

interface CredentialPublic {
  id: string;
  label: string;
  kind: "ssh_key" | "password";
  has_passphrase: boolean;
  created_at: number;
  updated_at: number;
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<CredentialPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialPublic | null>(null);

  const stats = useMemo(() => ({
    total: credentials.length,
    passwords: credentials.filter((c) => c.kind === "password").length,
    keys: credentials.filter((c) => c.kind === "ssh_key").length,
  }), [credentials]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/credentials");
    const data = await res.json();
    setCredentials(data.credentials ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this credential profile? Nodes using it will no longer be able to connect.")) return;
    const res = await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Credential deleted");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Delete failed");
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Credentials"
        description="Manage reusable SSH authentication profiles. Save a password or private key once, then attach it to many nodes."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-white/10 bg-white/5">
              <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New profile
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Profiles" value={stats.total} />
          <Stat label="Passwords" value={stats.passwords} />
          <Stat label="Private keys" value={stats.keys} />
        </div>

        {credentials.length === 0 && !loading ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03]">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <KeyRound className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold">No credential profiles yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a Termius-style profile for shared passwords or VPS private keys.
              </p>
              <Button className="mt-5" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Add first profile
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {credentials.map((credential) => (
              <div key={credential.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                      {credential.kind === "password" ? <Shield className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{credential.label}</h2>
                        <Badge variant="outline">{credential.kind === "password" ? "password" : "private key"}</Badge>
                        {credential.has_passphrase && <Badge variant="secondary">passphrase</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {new Date(credential.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(credential)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300" onClick={() => remove(credential.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <CredentialDialog mode="create" onDone={() => { setOpen(false); load(); }} />
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && <CredentialDialog mode="edit" credential={editing} onDone={() => { setEditing(null); load(); }} />}
      </Dialog>
    </div>
  );
}

function CredentialDialog({
  mode,
  credential,
  onDone,
}: {
  mode: "create" | "edit";
  credential?: CredentialPublic;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    label: credential?.label ?? "",
    kind: credential?.kind ?? "password",
    secret: "",
    passphrase: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      label: form.label,
      kind: form.kind,
      secret: form.secret || undefined,
      passphrase: form.kind === "ssh_key" ? form.passphrase || undefined : null,
    };
    if (mode === "create" && !payload.secret) {
      setSubmitting(false);
      toast.error(form.kind === "password" ? "Password is required" : "Private key is required");
      return;
    }
    const res = await fetch(mode === "edit" && credential ? `/api/credentials/${credential.id}` : "/api/credentials", {
      method: mode === "edit" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success(mode === "edit" ? "Credential updated" : "Credential created");
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
          <DialogTitle className="text-lg">{mode === "edit" ? "Edit credential profile" : "New credential profile"}</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Secret fields are encrypted at rest and never returned by the API.
          </p>
        </div>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Profile label" required>
            <Input value={form.label} onChange={(e) => update("label", e.target.value)} placeholder="username ssh" required className="h-10 bg-white/[0.04]" />
          </Field>
          <Field label="Profile type" required>
            <Select value={form.kind} onValueChange={(v) => update("kind", (v ?? "password") as CredentialPublic["kind"])}>
              <SelectTrigger className="h-10 bg-white/[0.04]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="ssh_key">Private key</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={form.kind === "password" ? (mode === "edit" ? "New password" : "Password") : (mode === "edit" ? "New private key" : "Private key")} required={mode === "create"}>
          {form.kind === "password" ? (
            <Input
              type="password"
              value={form.secret}
              onChange={(e) => update("secret", e.target.value)}
              placeholder={mode === "edit" ? "Leave blank to keep current secret" : "Password for SSH login"}
              required={mode === "create"}
              className="h-10 bg-white/[0.04]"
            />
          ) : (
            <textarea
              value={form.secret}
              onChange={(e) => update("secret", e.target.value)}
              placeholder={mode === "edit" ? "Leave blank to keep current private key" : "-----BEGIN OPENSSH PRIVATE KEY-----\n..."}
              required={mode === "create"}
              className="min-h-44 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-cyan-300/50"
            />
          )}
        </Field>
        {form.kind === "ssh_key" && (
          <Field label="Private key passphrase">
            <Input type="password" value={form.passphrase} onChange={(e) => update("passphrase", e.target.value)} placeholder="Optional; leave blank to keep unchanged when editing" className="h-10 bg-white/[0.04]" />
          </Field>
        )}
        <DialogFooter className="mx-0 mb-0 rounded-2xl border-white/10 bg-white/[0.03]">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : mode === "edit" ? "Update profile" : "Create profile"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-4 text-3xl font-bold">{value}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
