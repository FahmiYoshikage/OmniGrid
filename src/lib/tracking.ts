/**
 * Lightweight, zero-dependency event tracking for CTAs and WhatsApp interactions.
 * Safely interoperates with Google Tag Manager (dataLayer), Google Analytics (gtag),
 * and standard browser custom events without throwing or blocking UI threads.
 */

declare global {
    interface Window {
        dataLayer?: Array<Record<string, unknown>>;
        gtag?: (...args: unknown[]) => void;
    }
}

export interface TrackEventPayload {
    event: string;
    category?: string;
    action?: string;
    label?: string;
    value?: number;
    metadata?: Record<string, unknown>;
}

export function trackEvent({
    event,
    category = 'engagement',
    action,
    label,
    value,
    metadata = {},
}: TrackEventPayload): void {
    if (typeof window === 'undefined') return;

    const payload = {
        event,
        category,
        action: action || event,
        label,
        value,
        timestamp: Date.now(),
        ...metadata,
    };

    // 1. GTM / GA4 dataLayer
    if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push(payload);
    }

    // 2. Google Analytics gtag()
    if (typeof window.gtag === 'function') {
        window.gtag('event', action || event, {
            event_category: category,
            event_label: label,
            value,
            ...metadata,
        });
    }

    // 3. Custom DOM event for internal / client-side listeners
    try {
        window.dispatchEvent(
            new CustomEvent('omnigrid:track', { detail: payload })
        );
    } catch {
        // Ignore environments without CustomEvent support
    }
}

/** Track user clicks on primary or secondary Call-To-Action buttons */
export function trackCtaClick(
    ctaName: string,
    destination?: string,
    metadata?: Record<string, unknown>
): void {
    trackEvent({
        event: 'cta_click',
        category: 'conversion',
        action: 'click_cta',
        label: ctaName,
        metadata: {
            cta_name: ctaName,
            destination: destination || window.location.pathname,
            ...metadata,
        },
    });
}

/** Track user clicks to open WhatsApp support or contact */
export function trackWhatsAppClick(
    source = 'website_cta',
    phoneNumber?: string
): void {
    trackEvent({
        event: 'whatsapp_click',
        category: 'lead',
        action: 'click_whatsapp',
        label: source,
        metadata: {
            source,
            phone: phoneNumber || process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '628123456789',
        },
    });
}

/** Format clean WhatsApp click-to-chat URL */
export function getWhatsAppLink(
    customText = 'Hello OmniGrid team, I would like to inquire about Zero Trust Server Operations.'
): string {
    const phone = (
        process.env.NEXT_PUBLIC_WHATSAPP_PHONE ||
        '628123456789'
    ).replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(customText);
    return `https://wa.me/${phone}?text=${encodedText}`;
}
