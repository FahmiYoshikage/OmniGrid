import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Compass, Home, LayoutDashboard, Terminal } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '404 - Page Not Found | OmniGrid',
    description: 'The requested resource or page does not exist on OmniGrid.',
    robots: {
        index: false,
        follow: false,
    },
};

export default function NotFound() {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 py-16 text-white">
            {/* Ambient background glow */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-tr from-cyan-500/20 to-emerald-500/10 blur-3xl"
            />

            <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
                <Link href="/" className="mb-8 flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                        <Image
                            src="/logo.svg"
                            alt="OmniGrid"
                            width={32}
                            height={32}
                            priority
                        />
                    </div>
                    <span className="text-xl font-black tracking-tight text-white">
                        OmniGrid
                    </span>
                </Link>

                <div className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-300">
                    <Compass className="h-3.5 w-3.5 animate-pulse" />
                    <span>HTTP 404 · Resource Not Found</span>
                </div>

                <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl text-zinc-100">
                    Lost in the Grid?
                </h1>

                <p className="mt-3 text-sm leading-6 text-zinc-400 max-w-md">
                    The page or endpoint you are looking for does not exist, has been moved, or belongs to an unmanaged route.
                </p>

                <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                        <Home className="h-4 w-4 text-cyan-300" />
                        Back to Home
                    </Link>

                    <Link
                        href="/docs"
                        className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                    >
                        <BookOpen className="h-4 w-4 text-lime-300" />
                        Documentation
                    </Link>

                    <Link
                        href="/dashboard"
                        className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                    >
                        <LayoutDashboard className="h-4 w-4 text-cyan-400" />
                        Fleet Dashboard
                    </Link>

                    <Link
                        href="/terminal"
                        className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                    >
                        <Terminal className="h-4 w-4 text-emerald-400" />
                        Web SSH Terminal
                    </Link>
                </div>

                <div className="mt-10 border-t border-white/10 pt-6 text-xs text-zinc-500">
                    Zero Trust Server Operations Standard · OmniGrid Network Architecture
                </div>
            </div>
        </main>
    );
}
