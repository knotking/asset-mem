import { thinkingStatusFromLifecycle } from "../src/lib/agent-lifecycle-stream";

describe("thinkingStatusFromLifecycle", () => {
  it("uses message from Firestore", () => {
    const status = thinkingStatusFromLifecycle({
      phase: "proxy.engine_invoke",
      message: "Setting things up...",
      ts: "2026-01-01T00:00:00Z",
    });
    expect(status?.header).toBe("Setting things up...");
    expect(status?.preview).toBeNull();
  });

  it("falls back to phase map", () => {
    const status = thinkingStatusFromLifecycle({
      phase: "engine.turn_started",
      message: "",
    });
    expect(status?.header).toBe("Reviewing details...");
  });
});
