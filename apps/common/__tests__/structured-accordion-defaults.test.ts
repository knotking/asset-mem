import { getStructuredAccordionDefaultValue } from "../src/lib/structured-accordion-defaults";

describe("getStructuredAccordionDefaultValue", () => {
  it("keeps all sections collapsed while pipeline branches or synthesis are in progress", () => {
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

  it("keeps summary collapsed when synthesis markdown is present", () => {
    expect(
      getStructuredAccordionDefaultValue(
        {
          hasSummaryMarkdown: true,
          hasCheckpointSummary: true,
        },
        "web"
      )
    ).toBeUndefined();
  });

  it("opens checkpoint summary when complete without synthesis markdown", () => {
    expect(
      getStructuredAccordionDefaultValue(
        {
          hasCheckpointSummary: true,
        },
        "web"
      )
    ).toBe("checkpoint-summary");
  });
});
