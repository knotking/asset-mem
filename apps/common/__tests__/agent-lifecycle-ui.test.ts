import {
  countPriorAssistantTurnsInSession,
  resolveAssistantLoadingUi,
} from "../src/lib/agent-lifecycle-ui";

describe("countPriorAssistantTurnsInSession", () => {
  const thread = [
    { id: "intro-message", role: "assistant" },
    { id: "u1", role: "user" },
    { id: "a1", role: "assistant" },
    { id: "u2", role: "user" },
    { id: "local-placeholder", role: "assistant" },
    { id: "a2", role: "assistant" },
  ];

  it("counts only prior non-excluded assistant messages", () => {
    expect(countPriorAssistantTurnsInSession(thread, "a1")).toBe(0);
    expect(countPriorAssistantTurnsInSession(thread, "a2")).toBe(1);
  });
});

describe("resolveAssistantLoadingUi", () => {
  const base = {
    role: "assistant",
    agentStepCount: 0,
    hasDisplayableContent: false,
    isActiveLoading: true,
    priorAssistantTurnCount: 0,
    followUpStripReady: true,
  };

  it("first turn proxy: lifecycle strip with copy and wave", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      agentLifecycle: {
        phase: "proxy.request_accepted",
        message: "On it...",
      },
    });
    expect(ui.showLifecycleStrip).toBe(true);
    expect(ui.showTypingIndicator).toBe(false);
    expect(ui.lifecycleHeader).toBe("On it...");
    expect(ui.useProxyWaveIndicator).toBe(true);
  });

  it("follow-up proxy: wave bubble dots, no lifecycle strip copy", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      priorAssistantTurnCount: 1,
      agentLifecycle: {
        phase: "proxy.engine_invoke",
        message: "Setting things up...",
      },
    });
    expect(ui.showLifecycleStrip).toBe(false);
    expect(ui.showTypingIndicator).toBe(true);
    expect(ui.typingIndicatorVariant).toBe("wave");
    expect(ui.lifecycleHeader).toBe("");
  });

  it("follow-up engine.turn_started: wave bubble, no strip", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      priorAssistantTurnCount: 2,
      followUpStripReady: true,
      agentLifecycle: {
        phase: "engine.turn_started",
        message: "",
      },
    });
    expect(ui.showLifecycleStrip).toBe(false);
    expect(ui.showTypingIndicator).toBe(true);
    expect(ui.typingIndicatorVariant).toBe("wave");
  });

  it("follow-up engine.runner_exec: wave bubble, no strip", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      priorAssistantTurnCount: 2,
      agentLifecycle: {
        phase: "engine.runner_exec",
        message: "",
      },
    });
    expect(ui.showLifecycleStrip).toBe(false);
    expect(ui.typingIndicatorVariant).toBe("wave");
  });

  it("follow-up engine.before_model: strip when debounce ready", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      priorAssistantTurnCount: 2,
      followUpStripReady: true,
      agentLifecycle: {
        phase: "engine.before_model",
        message: "",
      },
    });
    expect(ui.showLifecycleStrip).toBe(true);
    expect(ui.showTypingIndicator).toBe(false);
    expect(ui.lifecycleHeader).toBe("Planning next moves...");
    expect(ui.typingIndicatorVariant).toBe("bounce");
  });

  it("follow-up engine.before_model: bounce until debounce ready", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      priorAssistantTurnCount: 2,
      followUpStripReady: false,
      agentLifecycle: {
        phase: "engine.before_model",
        message: "",
      },
    });
    expect(ui.showLifecycleStrip).toBe(false);
    expect(ui.showTypingIndicator).toBe(true);
    expect(ui.typingIndicatorVariant).toBe("bounce");
  });

  it("agent steps show thinking strip immediately", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      priorAssistantTurnCount: 3,
      followUpStripReady: false,
      agentStepCount: 1,
      agentLifecycle: {
        phase: "proxy.request_accepted",
        message: "On it...",
      },
    });
    expect(ui.showThinkingStrip).toBe(true);
    expect(ui.showTypingIndicator).toBe(false);
  });

  it("hides all in-message loading strips once structured content is visible", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      hasDisplayableContent: true,
      agentStepCount: 2,
    });
    expect(ui.showStatusStrip).toBe(false);
    expect(ui.showTypingIndicator).toBe(false);
  });

  it("returns empty when turn is not in flight", () => {
    const ui = resolveAssistantLoadingUi({
      ...base,
      hasDisplayableContent: true,
      isActiveLoading: false,
    });
    expect(ui.showStatusStrip).toBe(false);
  });
});
