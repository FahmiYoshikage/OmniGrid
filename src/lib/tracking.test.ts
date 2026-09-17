import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWhatsAppLink, trackCtaClick, trackEvent, trackWhatsAppClick } from "./tracking";

interface MockWindow {
  dataLayer?: Array<Record<string, unknown>>;
  gtag?: (...args: unknown[]) => void;
  dispatchEvent: (event: unknown) => boolean;
  location: { pathname: string };
}

const g = globalThis as unknown as { window?: MockWindow };

describe("Tracking & Event Dispatcher", () => {
  beforeEach(() => {
    g.window = {
      dataLayer: [],
      gtag: vi.fn(),
      dispatchEvent: vi.fn().mockReturnValue(true),
      location: { pathname: "/test" },
    };
  });

  afterEach(() => {
    delete g.window;
  });

  it("pushes events to dataLayer and calls gtag", () => {
    trackEvent({
      event: "test_event",
      category: "engagement",
      label: "test_label",
      value: 42,
    });

    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer![0].event).toBe("test_event");
    expect(window.dataLayer![0].label).toBe("test_label");

    expect(window.gtag).toHaveBeenCalledWith("event", "test_event", {
      event_category: "engagement",
      event_label: "test_label",
      value: 42,
    });
  });

  it("dispatches trackCtaClick with conversion category and metadata", () => {
    trackCtaClick("hero_open_control_plane", "/login");
    expect(window.dataLayer).toHaveLength(1);
    const event = window.dataLayer![0];
    expect(event.event).toBe("cta_click");
    expect(event.category).toBe("conversion");
    expect(event.label).toBe("hero_open_control_plane");
    expect(event["destination"]).toBe("/login");
  });

  it("dispatches trackWhatsAppClick and constructs proper WhatsApp chat URL", () => {
    trackWhatsAppClick("hero_button", "6281299998888");
    expect(window.dataLayer).toHaveLength(1);
    const event = window.dataLayer![0];
    expect(event.event).toBe("whatsapp_click");
    expect(event.category).toBe("lead");

    const link = getWhatsAppLink("Halo OmniGrid");
    expect(link).toContain("https://wa.me/");
    expect(link).toContain("Halo%20OmniGrid");
  });
});
