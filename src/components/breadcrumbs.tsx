import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { getBreadcrumbSchema } from '@/lib/seo';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    className?: string;
    includeHome?: boolean;
    includeSchema?: boolean;
}

export function Breadcrumbs({
    items,
    className = '',
    includeHome = true,
    includeSchema = true,
}: BreadcrumbsProps) {
    const allItems: BreadcrumbItem[] = includeHome
        ? [{ label: 'Home', href: '/' }, ...items]
        : items;

    const schemaItems = allItems.map((item) => ({
        name: item.label,
        path: item.href || '/',
    }));

    return (
        <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-zinc-400 ${className}`}>
            {includeSchema && (
                <script
                    type="application/ld+json"
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(getBreadcrumbSchema(schemaItems)),
                    }}
                />
            )}
            <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {allItems.map((item, index) => {
                    const isLast = index === allItems.length - 1;
                    return (
                        <li key={item.label} className="inline-flex items-center gap-1.5 sm:gap-2">
                            {index > 0 && (
                                <ChevronRight
                                    className="h-3.5 w-3.5 shrink-0 text-zinc-600"
                                    aria-hidden="true"
                                />
                            )}
                            {isLast || !item.href ? (
                                <span
                                    className="font-medium text-white"
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {index === 0 && includeHome ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Home className="h-3 w-3 text-cyan-300" />
                                            {item.label}
                                        </span>
                                    ) : (
                                        item.label
                                    )}
                                </span>
                            ) : (
                                <Link
                                    href={item.href}
                                    className="transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 rounded-sm"
                                >
                                    {index === 0 && includeHome ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Home className="h-3 w-3 text-zinc-400" />
                                            {item.label}
                                        </span>
                                    ) : (
                                        item.label
                                    )}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
