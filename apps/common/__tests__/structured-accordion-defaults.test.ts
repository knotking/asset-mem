import {
  getStructuredAccordionDefaultValue,
  structuredAccordionsCollapsed,
} from "../src/lib/structured-accordion-defaults";

describe("structuredAccordionsCollapsed", () => {
  it("stays collapsed while pipeline runs before checkpoint summary arrives", () => {
    expect(
      structuredAccordionsCollapsed({
        analysisInProgress: true,
        hasCheckpointSummary: false,
      })
    ).toBe(true);
  });

  it("does not collapse when checkpoint summary is already visible", () => {
    expect(
      structuredAccordionsCollapsed({
        analysisInProgress: true,
        hasCheckpointSummary: true,
      })
    ).toBe(false);
  });
});

describe("getStructuredAccordionDefaultValue", () => {
  it("opens checkpoint summary while optional branches or synthesis are in progress", () => {
    expect(
      getStructuredAccordionDefaultValue(
        {
          analysisInProgress: true,
          hasCheckpointSummary: true,
          hasCoverage: true,
        },
        "web"
      )
    ).toBe("checkpoint-summary");
  });

  it("keeps sections collapsed while pipeline runs before checkpoint summary arrives", () => {
    expect(
      getStructuredAccordionDefaultValue(
        {
          analysisInProgress: true,
          hasCoverage: true,
        },
        "web"
      )
    ).toBeUndefined();
  });

  it("opens checkpoint summary when synthesis markdown is present", () => {
    expect(
      getStructuredAccordionDefaultValue(
        {
          hasCheckpointSummary: true,
        },
        "web"
      )
    ).toBe("checkpoint-summary");
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
