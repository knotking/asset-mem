import {
  getInFlightCheckpointProgressFromMessages,
  getSynthesisTurnProgress,
  hasPostContentPipelineWork,
  isSynthesisAnalysisInProgress,
  isSynthesisPendingAfterBranches,
  shouldShowDisplayTitleGradient,
  shouldShowSummaryAccordionPlaceholder,
  SYNTHESIS_WRITING_LABEL,
} from "../src/lib/checkpoint-branch-progress";
import { getThinkingStatusFromSteps } from "../src/lib/agent-display";

describe("synthesis analysisStatus", () => {
  it("detects synthesis running from analysisStatus", () => {
    const analysis = {
      analysisStatus: { coverage: "completed", synthesis: "running" },
    };
    expect(isSynthesisAnalysisInProgress(analysis)).toBe(true);
    expect(getSynthesisTurnProgress(analysis)?.header).toBe(SYNTHESIS_WRITING_LABEL);
  });

  it("prefers synthesis label in thinking status after branches complete", () => {
    const status = getThinkingStatusFromSteps(
      [{ name: "checkpoint_analysis_synthesis_agent", status: "executing" }],
      {
        messageContentJson: {
          analysis: {
            analysisStatus: { coverage: "completed", synthesis: "running" },
          },
        },
      }
    );
    expect(status.header).toBe(SYNTHESIS_WRITING_LABEL);
  });

  it("does not show summary placeholder or post-content strip for checkpoint-only tail", () => {
    const analysis = { checkpointSummary: { checkpointsAnalyzed: 2 } };
    const steps = [
      { name: "run_checkpoint_pipeline", status: "executing" as const },
    ];
    expect(shouldShowSummaryAccordionPlaceholder(analysis, steps)).toBe(false);
    expect(hasPostContentPipelineWork(analysis, steps)).toBe(false);
  });

  it("composer footer progress survives persisted prose content", () => {
    const progress = getInFlightCheckpointProgressFromMessages([
      {
        role: "assistant",
        content: "# Checkpoint analysis\n\nSummary prose",
        contentJson: {
          analysis: {
            checkpointSummary: { checkpointsAnalyzed: 1 },
            analysisStatus: { synthesis: "running" },
          },
        },
      },
    ]);
    expect(progress?.header).toBe(SYNTHESIS_WRITING_LABEL);
  });

  it("shows placeholder and strip when synthesis is running", () => {
    const analysis = {
      analysisStatus: { synthesis: "running" },
    };
    expect(shouldShowSummaryAccordionPlaceholder(analysis, null)).toBe(true);
    expect(hasPostContentPipelineWork(analysis, null)).toBe(true);
  });

  it("treats post-branch server gap as synthesis in flight while turn is open", () => {
    const analysis = {
      checkpointSummary: { checkpointsAnalyzed: 1 },
      analysisStatus: {
        coverage: "completed",
        diy: "completed",
        service: "completed",
        cost: "completed",
      },
    };
    const steps = [{ name: "run_checkpoint_pipeline", status: "executing" as const }];

    expect(isSynthesisPendingAfterBranches(analysis, { isTurnInFlight: true })).toBe(
      true
    );
    expect(
      shouldShowSummaryAccordionPlaceholder(analysis, steps, { isTurnInFlight: true })
    ).toBe(true);
    expect(
      hasPostContentPipelineWork(analysis, steps, { isTurnInFlight: true })
    ).toBe(true);
    expect(
      getSynthesisTurnProgress(analysis, { isTurnInFlight: true })?.header
    ).toBe(SYNTHESIS_WRITING_LABEL);
    expect(
      getInFlightCheckpointProgressFromMessages(
        [
          {
            role: "assistant",
            contentJson: { analysis },
          },
        ],
        { isStreamActive: true }
      )?.header
    ).toBe(SYNTHESIS_WRITING_LABEL);
    expect(
      getThinkingStatusFromSteps(steps, {
        messageContentJson: { analysis },
        isTurnInFlight: true,
      }).header
    ).toBe(SYNTHESIS_WRITING_LABEL);
  });

  it("does not infer synthesis pending when the turn is finished", () => {
    const analysis = {
      analysisStatus: {
        coverage: "completed",
        diy: "completed",
        service: "completed",
        cost: "completed",
      },
    };
    expect(isSynthesisPendingAfterBranches(analysis, { isTurnInFlight: false })).toBe(
      false
    );
    expect(
      getInFlightCheckpointProgressFromMessages(
        [{ role: "assistant", contentJson: { analysis } }],
        { isStreamActive: false }
      )
    ).toBeNull();
  });
});

describe("shouldShowDisplayTitleGradient", () => {
  it("returns true while turn is in flight even when analysisStatus is idle", () => {
    expect(
      shouldShowDisplayTitleGradient({
        structured: {
          analysis: {
            title: "Garage door",
            checkpointSummary: { checkpointsAnalyzed: 1 },
          },
        },
        isTurnInFlight: true,
      })
    ).toBe(true);
  });

  it("returns true from executing optional-agent steps without analysisStatus", () => {
    expect(
      shouldShowDisplayTitleGradient({
        structured: {
          analysis: {
            title: "Garage door",
            checkpointSummary: { checkpointsAnalyzed: 1 },
          },
        },
        steps: [{ name: "coverage_agent", status: "executing" }],
      })
    ).toBe(true);
  });

  it("returns false when turn finished and pipeline is idle", () => {
    expect(
      shouldShowDisplayTitleGradient({
        structured: {
          analysis: {
            title: "Garage door",
            checkpointSummary: { checkpointsAnalyzed: 1 },
            analysisStatus: { coverage: "completed", synthesis: "completed" },
          },
        },
        steps: [{ name: "checkpoint_analysis_synthesis_agent", status: "completed" }],
        isTurnInFlight: false,
      })
    ).toBe(false);
  });
});
