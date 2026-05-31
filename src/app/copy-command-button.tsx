'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyCommandButton({ command }: { command: string }) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        await navigator.clipboard.writeText(command);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-lime-300 px-3 text-sm font-bold text-zinc-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-200 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
            {copied ? (
                <Check className="h-4 w-4" />
            ) : (
                <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}
