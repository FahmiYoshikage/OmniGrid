"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit3, FileCode2, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

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

const EMPTY_FORM = {
  name: "",
  description: "",
  shell: "bash",
  body: "#!/usr/bin/env bash\nset -euo pipefail\n\n",
};

export function RunbooksClient() {
  const [runbooks, setRunbooks] = useState<RunbookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

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
    void loadRunbooks();
  }, []);

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

  const filtered = runbooks.filter((runbook) => {
    const text = `${runbook.name} ${runbook.description ?? ""} ${runbook.shell}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

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
                Store command snippets and procedures here. Execution against nodes will be wired separately with explicit target selection and audit controls.
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
    </div>
  );
}
