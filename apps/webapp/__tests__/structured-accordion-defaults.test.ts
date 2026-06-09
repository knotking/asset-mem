import {
  getStructuredAccordionDefaultValue,
  structuredAccordionsCollapsed,
} from "@/lib/structured-accordion-defaults";

describe("structuredAccordionsCollapsed", () => {
  it("stays collapsed while pipeline runs before checkpoint summary arrives", () => {
    expect(
      structuredAccordionsCollapsed({
        analysisInProgress: true,
        hasCheckpointSummary: false,
      })
    ).toBe(true);
  });
});

describe("getStructuredAccordionDefaultValue (web)", () => {
  it("keeps sections collapsed when checkpoint summary is visible", () => {
    expect(
      getStructuredAccordionDefaultValue(
        {
          analysisInProgress: true,
          hasCheckpointSummary: true,
          hasCoverage: true,
        },
        "web"
      )
    ).toBeUndefined();
  });

  it("opens triage only for clarification", () => {
    expect(
      getStructuredAccordionDefaultValue(
        { needsClarification: true, hasCoverage: true },
        "web"
      )
    ).toBe("triage");
  });
});
