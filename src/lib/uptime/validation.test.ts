import { describe, expect, it } from "vitest";
import { isPrivateOrLocalAddress, parseHttpUrl, parseTcpTarget } from "./validation";

describe("uptime target validation", () => {
  it.each(["http://localhost/", "http://127.0.0.1/", "http://169.254.169.254/", "ftp://example.com/"])("rejects unsafe HTTP target %s", (target) => {
    expect(() => parseHttpUrl(target)).toThrow();
  });

  it("accepts public HTTP URLs", () => {
    expect(parseHttpUrl("https://example.com/health").protocol).toBe("https:");
  });

  it.each(["example.com:0", "example.com:65536", "example.com"])("rejects invalid TCP target %s", (target) => {
    expect(() => parseTcpTarget(target)).toThrow();
  });

  it("recognizes private IPv6 targets", () => {
    expect(isPrivateOrLocalAddress("::1")).toBe(true);
    expect(isPrivateOrLocalAddress("fc00::1")).toBe(true);
  });
});
