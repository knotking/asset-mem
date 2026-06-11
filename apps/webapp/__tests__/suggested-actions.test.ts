// Mirrors apps/common/__tests__/suggested-actions.test.ts (webapp keeps a
// synced copy of the parser instead of importing @homeapp/common).
import { getSuggestedActionsFromContentJson } from "@/lib/suggested-actions";

describe("getSuggestedActionsFromContentJson", () => {
  it("returns validated suggested actions", () => {
    const actions = getSuggestedActionsFromContentJson({
      suggestedActions: [
        { label: "Run cost", userQuery: "Run cost analysis", chatIntent: "new_analysis" },
        { label: "", userQuery: "skip" },
      ],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].userQuery).toBe("Run cost analysis");
  });

  it("passes through structured chip actions", () => {
    const actions = getSuggestedActionsFromContentJson({
      suggestedActions: [
        {
          label: "Run cost",
          userQuery: "Run cost analysis",
          chatIntent: "new_analysis",
          action: { type: "run_branch", branch: "cost" },
        },
        {
          label: "Why so expensive?",
          userQuery: "Why is pro so expensive?",
          action: { type: "discuss", topic: "cost" },
        },
        {
          label: "Show full report",
          userQuery: "Show me the full report",
          action: { type: "replay_report" },
        },
      ],
    });
    expect(actions[0].action).toEqual({ type: "run_branch", branch: "cost" });
    expect(actions[1].action).toEqual({ type: "discuss", topic: "cost" });
    expect(actions[2].action).toEqual({ type: "replay_report" });
  });

  it("drops malformed chip actions but keeps the chip", () => {
    const actions = getSuggestedActionsFromContentJson({
      suggestedActions: [
        {
          label: "Run cost",
          userQuery: "Run cost analysis",
          action: { type: "run_branch", branch: "bogus" },
        },
        {
          label: "Mystery",
          userQuery: "Do something",
          action: { type: "self_destruct" },
        },
      ],
    });
    expect(actions).toHaveLength(2);
    expect(actions[0].action).toBeUndefined();
    expect(actions[1].action).toBeUndefined();
  });
});
