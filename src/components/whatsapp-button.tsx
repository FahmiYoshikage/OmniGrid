'use client';

import { MessageCircle } from 'lucide-react';
import { getWhatsAppLink, trackWhatsAppClick } from '@/lib/tracking';

interface WhatsAppButtonProps {
    className?: string;
    source?: string;
    label?: string;
    text?: string;
    floating?: boolean;
}

export function WhatsAppButton({
    className = '',
    source = 'landing_floating',
    label = 'Chat Support',
    text,
    floating = false,
}: WhatsAppButtonProps) {
    const href = getWhatsAppLink(text);

    const handleClick = () => {
        trackWhatsAppClick(source);
    };

    if (floating) {
        return (
            <aside
                aria-label="WhatsApp Support Floating Action"
                className="fixed bottom-6 right-6 z-40 group"
            >
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleClick}
                    className="flex items-center gap-2.5 rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:bg-emerald-400 hover:scale-105 hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
                    aria-label="Contact support on WhatsApp"
                >
                    <MessageCircle className="h-5 w-5 fill-current" />
                    <span className="hidden sm:inline font-medium">{label}</span>
                </a>
            </aside>
        );
    }

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className={`inline-flex items-center gap-2 rounded-2xl bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 border border-emerald-500/30 ${className}`}
        >
            <MessageCircle className="h-4 w-4" />
            <span>{label}</span>
        </a>
    );
}
