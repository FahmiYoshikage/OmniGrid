import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, resetRateLimiterForTests, validateMutationOrigin } from "./request";

describe("request security", () => {
  const originalPublicUrl = process.env.OMNIGRID_PUBLIC_URL;
  beforeEach(() => resetRateLimiterForTests());

  it("requires the configured origin", () => {
    process.env.OMNIGRID_PUBLIC_URL = "https://app.example.test";
    expect(validateMutationOrigin(new Request("https://app.example.test/api", { headers: { origin: "https://app.example.test" } }))).toBeNull();
    expect(validateMutationOrigin(new Request("https://app.example.test/api", { headers: { origin: "https://evil.test" } }))?.status).toBe(403);
    expect(validateMutationOrigin(new Request("https://app.example.test/api"))?.status).toBe(403);
    if (originalPublicUrl === undefined) delete process.env.OMNIGRID_PUBLIC_URL;
    else process.env.OMNIGRID_PUBLIC_URL = originalPublicUrl;
  });

  it("bounds requests in a window", () => {
    expect(rateLimit("test", 2, 60_000)).toBeNull();
    expect(rateLimit("test", 2, 60_000)).toBeNull();
    expect(rateLimit("test", 2, 60_000)).toBeGreaterThan(0);
  });
});
