import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import {
  absoluteUrl,
  getBreadcrumbSchema,
  getLocalBusinessSchema,
  getOrganizationSchema,
  getSiteUrl,
  getSoftwareApplicationSchema,
  isPublicIndexablePath,
  PUBLIC_INDEXABLE_PATHS,
} from "@/lib/seo";

describe("SEO & Structured Data", () => {
  it("computes clean absolute URLs without double slashes", () => {
    const siteUrl = getSiteUrl();
    expect(absoluteUrl("/docs")).toBe(`${siteUrl}/docs`);
    expect(absoluteUrl("terms")).toBe(`${siteUrl}/terms`);
    expect(absoluteUrl("/")).toBe(`${siteUrl}/`);
  });

  it("identifies public indexable paths correctly", () => {
    expect(isPublicIndexablePath("/")).toBe(true);
    expect(isPublicIndexablePath("/docs")).toBe(true);
    expect(isPublicIndexablePath("/privacy-policy")).toBe(true);
    expect(isPublicIndexablePath("/terms")).toBe(true);
    expect(isPublicIndexablePath("/dashboard")).toBe(false);
    expect(isPublicIndexablePath("/terminal")).toBe(false);
    expect(isPublicIndexablePath("/login")).toBe(false);
  });

  it("generates valid Organization schema", () => {
    const schema = getOrganizationSchema();
    expect(schema["@type"]).toBe("Organization");
    expect(schema.name).toBe("OmniGrid Network Architecture");
    expect(schema.logo).toContain("/logo.png");
    expect(schema.url).toBe(getSiteUrl());
  });

  it("generates valid LocalBusiness / ProfessionalService schema", () => {
    const schema = getLocalBusinessSchema();
    expect(schema["@type"]).toBe("ProfessionalService");
    expect(schema.name).toBe("OmniGrid Network Architecture");
    expect(schema.priceRange).toBe("$$");
    expect(schema.geo).toBeDefined();
  });

  it("generates valid SoftwareApplication schema", () => {
    const schema = getSoftwareApplicationSchema();
    expect(schema["@type"]).toBe("SoftwareApplication");
    expect(schema.applicationCategory).toBe("DeveloperApplication");
    expect(schema.operatingSystem).toContain("Linux");
  });

  it("generates valid BreadcrumbList schema", () => {
    const breadcrumbs = [
      { name: "Home", path: "/" },
      { name: "Documentation", path: "/docs" },
    ];
    const schema = getBreadcrumbSchema(breadcrumbs);
    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[0].name).toBe("Home");
    expect(schema.itemListElement[1].position).toBe(2);
    expect(schema.itemListElement[1].name).toBe("Documentation");
  });

  it("generates a complete, prioritized sitemap", () => {
    const map = sitemap();
    expect(map).toHaveLength(PUBLIC_INDEXABLE_PATHS.length);
    const urls = map.map((m) => m.url);
    for (const path of PUBLIC_INDEXABLE_PATHS) {
      expect(urls).toContain(absoluteUrl(path));
    }
    const homeEntry = map.find((m) => m.url === absoluteUrl("/"));
    expect(homeEntry?.priority).toBe(1);
    const docsEntry = map.find((m) => m.url === absoluteUrl("/docs"));
    expect(docsEntry?.priority).toBe(0.9);
  });

  it("configures robots.txt to index public pages and disallow private dashboard endpoints", () => {
    const r = robots();
    expect(r.rules).toBeDefined();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.allow).toContain("/");
    expect(rules.allow).toContain("/docs");
    expect(rules.allow).toContain("/favicon.ico");
    expect(rules.disallow).toContain("/dashboard");
    expect(rules.disallow).toContain("/terminal");
    expect(rules.disallow).toContain("/nodes");
    expect(rules.disallow).toContain("/runbooks");
    expect(rules.disallow).toContain("/api/");
    expect(r.sitemap).toBe(absoluteUrl("/sitemap.xml"));
  });
});
