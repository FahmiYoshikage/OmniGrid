'use client';

import React from 'react';
import Link from 'next/link';
import { trackCtaClick } from '@/lib/tracking';

interface TrackableLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    ctaName: string;
    children: React.ReactNode;
    className?: string;
}

export function TrackableLink({
    href,
    ctaName,
    children,
    className,
    onClick,
    ...props
}: TrackableLinkProps) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        trackCtaClick(ctaName, href);
        if (onClick) onClick(e);
    };

    return (
        <Link
            href={href}
            onClick={handleClick}
            className={className}
            data-track-cta={ctaName}
            {...props}
        >
            {children}
        </Link>
    );
}

interface TrackableButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    ctaName: string;
    children: React.ReactNode;
    className?: string;
}

export function TrackableButton({
    ctaName,
    children,
    className,
    onClick,
    ...props
}: TrackableButtonProps) {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        trackCtaClick(ctaName);
        if (onClick) onClick(e);
    };

    return (
        <button
            onClick={handleClick}
            className={className}
            data-track-cta={ctaName}
            {...props}
        >
            {children}
        </button>
    );
}
