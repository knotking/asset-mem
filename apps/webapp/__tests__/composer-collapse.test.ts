import { buildCollapsedComposerSummary } from "@/lib/composer-collapse";

describe("composer-collapse", () => {
  it("includes optional agent count in summary", () => {
    expect(
      buildCollapsedComposerSummary({
        primaryAgent: "checkpoint",
        selectedOptionalAgents: [],
        selectedCheckpointOptionalAgents: ["coverage", "diy", "service", "cost"],
        readyContextCount: 0,
        pendingContextCount: 0,
        hasQueuedSend: false,
      }),
    ).toBe("Checkpoint +4");
  });

  it("includes attached count and queued send", () => {
    expect(
      buildCollapsedComposerSummary({
        primaryAgent: "docs",
        selectedOptionalAgents: [],
        selectedCheckpointOptionalAgents: [],
        readyContextCount: 2,
        pendingContextCount: 0,
        hasQueuedSend: false,
      }),
    ).toBe("Docs · 2 attached");
  });
});
