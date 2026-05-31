import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, Globe, TerminalSquare, ShieldCheck } from "lucide-react";

const BRAND_NAME = "OmniGrid Network Architecture";
const BOOTSTRAP_CMD =
  "curl -fsSL https://gist.githubusercontent.com/FahmiYoshikage/38fbbbfe4ab544bb16e9844efec64e51/raw/ce59bb410f50f0f13096068de5d77695c1f4b077/omnigrid-bootstrap.sh | sudo bash";

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                <Image src="/logo.svg" alt={BRAND_NAME} width={28} height={28} priority />
              </div>
              <div>
                <div className="font-bold tracking-tight">{BRAND_NAME}</div>
                <div className="text-xs text-cyan-100/60">Zero Trust server operations</div>
              </div>
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              <FileText className="h-4 w-4" /> Documentation
            </div>
          </div>
          <div className="pt-8">
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">OmniGrid operator documentation</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Everything you need to bootstrap servers, connect to omnigrid-net, and operate a Zero Trust fleet.
              This guide focuses on production-ready workflow for homelabs, VPS fleets, and private networks.
            </p>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <DocTile
            icon={<TerminalSquare className="h-5 w-5" />}
            title="Bootstrap nodes"
            desc="Install Docker, join omnigrid-net, and prepare workloads with the one-line script."
            href="#bootstrap"
          />
          <DocTile
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Zero Trust auth"
            desc="Set up GitHub, Google, or email magic links with workspace-scoped access."
            href="#auth"
          />
          <DocTile
            icon={<Globe className="h-5 w-5" />}
            title="Cloudflare Tunnel"
            desc="Publish internal apps safely and monitor Access apps from OmniGrid."
            href="#cloudflare"
          />
        </section>

        <section id="bootstrap" className="rounded-3xl border border-white/10 bg-black/20 p-6">
          <h2 className="text-2xl font-semibold">Bootstrap a server</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This bootstrap script turns a fresh Linux host into the OmniGrid standard. It installs Docker, joins
            the external network <span className="text-cyan-200">omnigrid-net</span>, and prepares the host for
            managed workloads.
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-xs text-cyan-100">
            {BOOTSTRAP_CMD}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Run as root or with sudo. Review the script before executing in production environments.
          </p>
        </section>

        <section id="auth" className="rounded-3xl border border-white/10 bg-black/20 p-6">
          <h2 className="text-2xl font-semibold">Authentication setup</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            OmniGrid supports GitHub OAuth, Google OAuth, and email magic links. Configure at least one provider
            in your <span className="text-cyan-200">.env.production</span> and keep <span className="text-cyan-200">OMNIGRID_PUBLIC_URL</span> aligned
            with the public origin.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoCard title="GitHub OAuth" body="Set the callback to /api/auth/github/callback." />
            <InfoCard title="Google OAuth" body="Set the callback to /api/auth/google/callback." />
            <InfoCard title="Email magic links" body="Provide GMAIL_SMTP_USER + GMAIL_SMTP_APP_PASSWORD." />
            <InfoCard title="Workspace scope" body="Integration secrets are stored per workspace, encrypted at rest." />
          </div>
        </section>

        <section id="cloudflare" className="rounded-3xl border border-white/10 bg-black/20 p-6">
          <h2 className="text-2xl font-semibold">Cloudflare Tunnel workflow</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Publish internal apps with Cloudflare Zero Trust and monitor tunnels, Access apps, and DNS from OmniGrid.
            Use the Settings page to store Cloudflare credentials per workspace.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>1. Save Cloudflare Account ID, Tunnel Token, and API token.</li>
            <li>2. Run cloudflared in your infrastructure with omnigrid-net access.</li>
            <li>3. Publish hostnames from the Tunnel dashboard in OmniGrid.</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Need the full product guide?</h3>
              <p className="mt-1 text-sm text-slate-300">Check the README for deeper architecture and deployment notes.</p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Open OmniGrid <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-3 pb-6 text-xs text-slate-500">
          <Link href="/privacy-policy" className="transition hover:text-white">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/terms" className="transition hover:text-white">
            Terms of Service
          </Link>
          <span>•</span>
          <Link href="/" className="transition hover:text-white">
            Back to landing
          </Link>
        </div>
      </div>
    </main>
  );
}

function DocTile({
  icon,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-cyan-300/30 hover:bg-white/[0.06]"
    >
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
    </Link>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{title}</div>
      <p className="mt-2 text-sm text-slate-200/90">{body}</p>
    </div>
  );
}
