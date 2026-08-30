import Link from "next/link";
import { Filter, ScrollText, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireSessionUser } from "@/lib/auth/access";
import { auditRepo } from "@/lib/db/repos/audit";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string; page?: string }>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const action = params.action?.slice(0, 100) || "";
  const query = params.q?.trim().slice(0, 100) || "";
  const requestedPage = Number.parseInt(params.page || "1", 10);
  const requested = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  let page = requested;
  let result = auditRepo.page({
    workspaceId: user.workspaceId,
    action: action || undefined,
    query: query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  if (page > pages) {
    page = pages;
    result = auditRepo.page({
      workspaceId: user.workspaceId,
      action: action || undefined,
      query: query || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  }
  const actions = auditRepo.actions(user.workspaceId);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Audit Log"
        description="Workspace-scoped record of operational activity, including SSH, runbook, and Wake-on-LAN events."
      />
      <div className="space-y-5 p-8">
        <form className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={query} placeholder="Search actor, action, or detail" className="h-10 bg-black/20 pl-10" />
          </label>
          <label className="relative">
            <Filter className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              name="action"
              defaultValue={action}
              className="h-10 min-w-52 appearance-none rounded-lg border border-white/10 bg-black/30 pl-10 pr-8 text-sm outline-none focus:border-cyan-300/50"
            >
              <option value="">All actions</option>
              {actions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <Button type="submit" className="h-10">Apply filters</Button>
          {(query || action) && <Button render={<Link href="/audit" />} variant="outline" className="h-10">Clear</Button>}
        </form>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-medium"><ScrollText className="h-4 w-4 text-cyan-200" /> Activity</div>
            <span className="text-xs text-muted-foreground">{result.total} {result.total === 1 ? "event" : "events"}</span>
          </div>
          {result.entries.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center text-sm text-muted-foreground">No audit events match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <tr><th className="px-5 py-3 font-medium">Time</th><th className="px-5 py-3 font-medium">Action</th><th className="px-5 py-3 font-medium">Actor</th><th className="px-5 py-3 font-medium">Target / detail</th></tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {result.entries.map((entry, index) => (
                    <tr key={`${entry.ts}-${index}`} className="transition-colors hover:bg-white/[0.025]">
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-muted-foreground">{new Date(entry.ts).toLocaleString()}</td>
                      <td className="px-5 py-4"><Badge variant="outline" className={entry.action.endsWith("failed") ? "border-red-400/25 text-red-200" : "border-cyan-300/20 text-cyan-100"}>{entry.action}</Badge></td>
                      <td className="px-5 py-4">{entry.actor}</td>
                      <td className="max-w-xl px-5 py-4 font-mono text-xs text-muted-foreground">
                        {entry.node_id && <span className="mr-3 text-foreground">node:{entry.node_id.slice(0, 8)}</span>}
                        {formatDetail(entry.detail)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-xs text-muted-foreground">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <PageLink page={page - 1} disabled={page <= 1} action={action} query={query}>Previous</PageLink>
              <PageLink page={page + 1} disabled={page >= pages} action={action} query={query}>Next</PageLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageLink({ page, disabled, action, query, children }: { page: number; disabled: boolean; action: string; query: string; children: React.ReactNode }) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (action) params.set("action", action);
  if (page > 1) params.set("page", String(page));
  const href = `/audit${params.size ? `?${params}` : ""}`;
  return <Button render={disabled ? undefined : <Link href={href} />} variant="outline" size="sm" disabled={disabled}>{children}</Button>;
}

function formatDetail(detail: unknown) {
  if (detail === undefined || detail === null) return "-";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return "[unavailable]";
  }
}
