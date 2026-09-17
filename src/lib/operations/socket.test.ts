import { describe, expect, it } from "vitest";
import { createOperationsEventStore } from "./socket";

describe("operations event replay", () => {
  it("assigns workspace-local sequences and filters replay by job", () => {
    const store = createOperationsEventStore();
    store.publish({ workspaceId: "workspace-a", jobId: "job-1", type: "started", payload: {} });
    store.publish({ workspaceId: "workspace-a", jobId: "job-2", type: "started", payload: {} });
    store.publish({ workspaceId: "workspace-b", jobId: "job-1", type: "started", payload: {} });

    expect(store.replay("workspace-a", 0, "job-1")).toMatchObject([
      { workspaceId: "workspace-a", jobId: "job-1", sequence: 1 },
    ]);
    expect(store.replay("workspace-a", 1)).toMatchObject([
      { jobId: "job-2", sequence: 2 },
    ]);
    expect(store.replay("workspace-b", 0)).toMatchObject([
      { workspaceId: "workspace-b", sequence: 1 },
    ]);
  });

  it("keeps only the configured replay window", () => {
    const store = createOperationsEventStore(2);
    store.publish({ workspaceId: "workspace-a", type: "one", payload: null });
    store.publish({ workspaceId: "workspace-a", type: "two", payload: null });
    store.publish({ workspaceId: "workspace-a", type: "three", payload: null });

    expect(store.replay("workspace-a", 0).map((event) => event.type)).toEqual(["two", "three"]);
  });
});
