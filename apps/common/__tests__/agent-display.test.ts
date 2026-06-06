import type { AgentStep } from "../src/types";
import { getThinkingStatusFromSteps } from "../src/lib/agent-display";

describe("getThinkingStatusFromSteps", () => {
  it("prefers branch progress from nested contentJson over rollup agent step", () => {
    const steps: AgentStep[] = [
      { name: "run_checkpoint_pipeline", status: "executing" },
    ];
    const status = getThinkingStatusFromSteps(steps, {
      messageContentJson: {
        analysis: {
          analysisStatus: { coverage: "running" },
        },
      },
    });
    expect(status.header).toBe("Analyzing checkpoints…");
    expect(status.preview).toBe("Coverage in progress");
  });

  it("prefers coverage agent step over run_checkpoint_pipeline rollup", () => {
    const steps: AgentStep[] = [
      { name: "run_checkpoint_pipeline", status: "executing" },
      { name: "coverage_agent", status: "executing" },
    ];
    expect(getThinkingStatusFromSteps(steps).header).toBe(
      "Checking warranty & insurance…",
    );
  });
});
