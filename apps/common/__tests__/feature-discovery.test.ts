import {
  CHAT_SESSION_EMPTY_INTRO,
  CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS,
  CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS_BY_AGENT,
  getSuggestedPrompts,
  getChatIntroCopy,
  getDefaultChatIntroCopy,
  resolveChatDiscoveryCounts,
  getDiscoveryStepStates,
  shouldShowDiscoveryChecklist,
  shouldShowFeatureTip,
  hasDismissedFeatureTips,
  messageHasStructuredAssistantContent,
} from "../src/lib/feature-discovery";
import type { Property, UserPreferences } from "../src/types";

const baseProperty = {
  id: "p1",
  name: "Home",
  address: "1 Main St",
  cityStateZip: "City, ST 00000",
  documents: [],
  checksCount: 0,
} as unknown as Property;

describe("feature-discovery", () => {
  it("uses static chat empty intro in all conditions", () => {
    expect(getChatIntroCopy()).toEqual(CHAT_SESSION_EMPTY_INTRO);
    expect(
      getChatIntroCopy({
        hasOpenedChatFromOnboarding: false,
        checkpointCount: 0,
        documentCount: 0,
      })
    ).toEqual(CHAT_SESSION_EMPTY_INTRO);
    expect(
      getChatIntroCopy({
        hasOpenedChatFromOnboarding: true,
        checkpointCount: 5,
        documentCount: 3,
      })
    ).toEqual(CHAT_SESSION_EMPTY_INTRO);
    expect(getDefaultChatIntroCopy()).toEqual(CHAT_SESSION_EMPTY_INTRO);
  });

  it("returns checkpoint prompts by default", () => {
    expect(getSuggestedPrompts()).toEqual([...CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS]);
    expect(getSuggestedPrompts({ primaryAgent: "checkpoint" })).toEqual([
      ...CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS,
    ]);
  });

  it("returns agent-specific suggested prompts", () => {
    expect(getSuggestedPrompts({ primaryAgent: "docs" })).toEqual([
      ...CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS_BY_AGENT.docs,
    ]);
    expect(getSuggestedPrompts({ primaryAgent: "report" })).toEqual([
      ...CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS_BY_AGENT.report,
    ]);
  });

  it("resolves discovery counts for contextual tips", () => {
    const listProperty = { ...baseProperty, checks: 3, docs: 1 };
    const counts = resolveChatDiscoveryCounts(listProperty, 0, 0);
    expect(counts.checkpointCount).toBe(3);
    expect(counts.documentCount).toBe(1);
  });

  it("tracks discovery checklist completion", () => {
    const prefs: UserPreferences = {
      discoveryCompareDone: true,
      discoveryOptionalAgentUsed: true,
    };
    const { completedCount, allDone } = getDiscoveryStepStates(prefs);
    expect(completedCount).toBe(2);
    expect(allDone).toBe(false);
  });

  it("shows discovery checklist after onboarding finished", () => {
    const prefs: UserPreferences = {
      onboardingChatOpened: true,
      onboardingChecklistDismissed: true,
    };
    expect(shouldShowDiscoveryChecklist([baseProperty], prefs)).toBe(true);
  });

  it("respects dismissed feature tips", () => {
    const prefs: UserPreferences = {
      featureTipsDismissed: { quota_limit: true },
    };
    expect(shouldShowFeatureTip(prefs, "quota_limit")).toBe(false);
    expect(shouldShowFeatureTip(prefs, "checkpoints_compare")).toBe(true);
  });

  it("detects dismissed feature tips for reset affordance", () => {
    expect(hasDismissedFeatureTips(null)).toBe(false);
    expect(hasDismissedFeatureTips({})).toBe(false);
    expect(
      hasDismissedFeatureTips({ featureTipsDismissed: { chat_optional_agents: true } })
    ).toBe(true);
  });

  it("detects structured assistant content", () => {
    expect(
      messageHasStructuredAssistantContent({
        role: "assistant",
        contentJson: { triage: {} },
      })
    ).toBe(true);
    expect(
      messageHasStructuredAssistantContent({
        role: "assistant",
        contentJson: null,
      })
    ).toBe(false);
  });
});
