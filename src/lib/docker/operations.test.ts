import { describe, expect, it } from "vitest";
import { validateContainerId } from "./operations";

describe("Docker Container Operations", () => {
  it("validates valid container IDs and names", () => {
    expect(() => validateContainerId("vaultwarden-app")).not.toThrow();
    expect(() => validateContainerId("c1234567890a")).not.toThrow();
    expect(() => validateContainerId("grafana_server.1")).not.toThrow();
    expect(() => validateContainerId("app-prod-01")).not.toThrow();
  });

  it("rejects invalid or malicious container IDs", () => {
    expect(() => validateContainerId("; rm -rf /")).toThrow("Invalid container identifier");
    expect(() => validateContainerId("app$(whoami)")).toThrow("Invalid container identifier");
    expect(() => validateContainerId("app && echo 1")).toThrow("Invalid container identifier");
    expect(() => validateContainerId("")).toThrow("Invalid container identifier");
    expect(() => validateContainerId("-invalid-start")).toThrow("Invalid container identifier");
  });
});
