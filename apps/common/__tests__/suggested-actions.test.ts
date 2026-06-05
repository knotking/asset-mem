import { getSuggestedActionsFromContentJson } from "../src/lib/suggested-actions";

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
});
