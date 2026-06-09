import { getPrimaryAgentIcon, getPrimaryAgentLabel } from "@/lib/primary-agent-display";

describe("primary-agent-display", () => {
  it("returns user-facing labels", () => {
    expect(getPrimaryAgentLabel("analysis")).toBe("Analysis");
    expect(getPrimaryAgentLabel("checkpoint")).toBe("Checkpoint");
    expect(getPrimaryAgentLabel("docs")).toBe("Docs");
    expect(getPrimaryAgentLabel("report")).toBe("Reports");
  });

  it("returns a component for each primary agent", () => {
    for (const agent of ["analysis", "checkpoint", "docs", "report"] as const) {
      expect(typeof getPrimaryAgentIcon(agent)).toBe("function");
    }
  });
});
