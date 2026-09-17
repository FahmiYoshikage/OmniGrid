import { describe, expect, it } from "vitest";
import { metadata as notFoundMeta } from "@/app/not-found";
import { metadata as termsMeta } from "@/app/terms/page";
import { metadata as privacyMeta } from "@/app/privacy-policy/page";
import { metadata as docsMeta } from "@/app/docs/page";
import { POST as emailRequestPost } from "@/app/api/auth/email/request/route";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Device Safetynet & E2E Verification", () => {
  it("verifies 404 page metadata is properly configured with noindex", () => {
    const robots = notFoundMeta.robots as { index?: boolean; follow?: boolean };
    expect(robots).toBeDefined();
    expect(robots.index).toBe(false);
    expect(robots.follow).toBe(false);
  });

  it("verifies canonical URLs are defined on all public documentation and legal pages", () => {
    expect(docsMeta.alternates?.canonical).toBeDefined();
    expect(termsMeta.alternates?.canonical).toBeDefined();
    expect(privacyMeta.alternates?.canonical).toBeDefined();
  });

  it("verifies anti-spam honeypot traps bots on form submissions", async () => {
    // 1. Invalid email format rejected
    const badReq = new Request("http://localhost:3000/api/auth/email/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    const badRes = await emailRequestPost(badReq);
    expect(badRes.status).toBe(400);

    // 2. Honeypot filled by bot -> silently return ok: true without sending email
    const botReq = new Request("http://localhost:3000/api/auth/email/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email: "bot@target.com", _gotcha: "spam-bot-value" }),
    });
    const botRes = await emailRequestPost(botReq);
    expect(botRes.status).toBe(200);
    const body = await botRes.json();
    expect(body.ok).toBe(true);
  });

  it("verifies critical public pages contain zero broken internal anchors", () => {
    const landingFile = readFileSync(join(process.cwd(), "src/app/landing-page.tsx"), "utf8");
    const docsFile = readFileSync(join(process.cwd(), "src/app/docs/page.tsx"), "utf8");

    // The landing page links to /docs#bootstrap
    expect(landingFile).toContain('href="/docs#bootstrap"');
    // The docs page must contain id="bootstrap"
    expect(docsFile).toContain('id="bootstrap"');

    // All section IDs referenced in docs NAV_ITEMS must exist in docs page
    const navAnchors = [
      'id="start-here"',
      'id="mental-model"',
      'id="terms"',
      'id="quickstart"',
      'id="architecture"',
      'id="features"',
      'id="security"',
      'id="production"',
    ];
    for (const anchor of navAnchors) {
      expect(docsFile).toContain(anchor);
    }
  });

  it("verifies public static favicon and webmanifest assets exist", () => {
    expect(existsSync(join(process.cwd(), "public/favicon.ico"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/logo.svg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/logo.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/site.webmanifest"))).toBe(true);
  });
});
