"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/topology", label: "Topology", icon: Network },
  { href: "/nodes", label: "Nodes", icon: Server },
  { href: "/terminal", label: "Terminal", icon: Terminal },
  { href: "/proxy", label: "Reverse Proxy", icon: Globe, soon: true },
  { href: "/uptime", label: "Uptime", icon: Activity, soon: true },
  { href: "/runbooks", label: "Runbooks", icon: PlayCircle, soon: true },
  { href: "/audit", label: "Audit Log", icon: ScrollText, soon: true },
  { href: "/wol", label: "Wake-on-LAN", icon: Power, soon: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen overflow-hidden text-foreground">
      <aside className="relative m-3 mr-0 flex w-64 shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-sidebar/80 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-cyan-400/15 to-transparent" />
        <div className="relative flex h-20 items-center gap-3 border-b border-white/10 px-4">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 via-cyan-300 to-sky-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20">
            OG
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight">OmniGrid</span>
            <span className="text-[11px] text-cyan-100/60">homelab command center</span>
          </div>
        </div>
        <nav className="relative flex flex-col gap-1 p-3">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-cyan-400/20 to-emerald-400/10 text-white shadow-inner ring-1 ring-cyan-300/20"
                    : "text-sidebar-foreground/55 hover:bg-white/5 hover:text-white",
                  item.soon && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl transition-colors",
                    active ? "bg-cyan-300/15 text-cyan-200" : "bg-white/[0.03] text-sidebar-foreground/45 group-hover:text-cyan-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">{item.label}</span>
                {item.soon && (
                  <span className="text-[10px] text-muted-foreground">soon</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="relative mt-auto p-3">
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-3 text-xs text-emerald-50/80">
            <div className="mb-1 flex items-center gap-2 font-medium text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" />
              Tailscale-first
            </div>
            Secure control plane for SSH, topology, proxy, and runbooks.
          </div>
        </div>
      </aside>
      <main className="m-3 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="h-full overflow-auto">{children}</div>
      </main>
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
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
