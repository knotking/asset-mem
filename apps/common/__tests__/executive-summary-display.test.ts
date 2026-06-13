import {
  extractExecutiveSummaryNarrative,
  getCostEstimateRecommendation,
  getSummaryAccordionPreview,
  summaryAccordionPreviewIsTruncated,
} from "../src/lib/executive-summary-display";

describe("extractExecutiveSummaryNarrative", () => {
  it("returns empty for blank input", () => {
    expect(extractExecutiveSummaryNarrative("")).toBe("");
  });

  it("keeps overview and next steps but drops duplicate cost/coverage sections", () => {
    const md = `# Executive Summary: Garage Door

Following the inspection, localized cosmetic damage was found on the garage door.

### Coverage & Insurance
Policy excludes wear and tear.

### Repair Options
* **DIY:** $100-250
* **Professional:** $350-800

### Next Steps
1. **If DIY:** Prep the surface before priming.
2. **If Service:** Contact local contractors for formal quotes.`;

    const narrative = extractExecutiveSummaryNarrative(md);
    expect(narrative).toContain("Following the inspection");
    expect(narrative).toContain("### Next Steps");
    expect(narrative).not.toContain("Coverage & Insurance");
    expect(narrative).not.toContain("Repair Options");
    expect(narrative).not.toContain("$350-800");
  });

  it("strips fenced JSON blocks", () => {
    const md = `# Title\n\nOverview text.\n\n\`\`\`json\n{"analysis":{}}\n\`\`\``;
    expect(extractExecutiveSummaryNarrative(md)).toBe("Overview text.");
  });

  it("omits leading checkpoint prose when structured checkpointSummary is shown", () => {
    const md = `# Garage Door Analysis

Following the inspection, paint chipping was found on the garage door.

### Next Steps
1. Prep the surface before priming.`;

    const narrative = extractExecutiveSummaryNarrative(md, {
      omitCheckpointSummaryMarkdown: true,
    });
    expect(narrative).not.toContain("Following the inspection");
    expect(narrative).toContain("### Next Steps");
  });

  it("drops prose-only checkpoint summary when omitting duplicate summary", () => {
    const md = `# Roof leak assessment

## Overview
Patch soon.

## Checkpoint Summary
Duplicate prose.`;

    const narrative = extractExecutiveSummaryNarrative(md, {
      omitCheckpointSummaryMarkdown: true,
    });
    expect(narrative).toContain("Patch soon.");
    expect(narrative).not.toContain("Duplicate prose.");
  });

  it("keeps executor prose after checkpoint summary when omitting duplicate summary", () => {
    const md = `# Checkpoint analysis

## Checkpoint Summary
- **Checkpoints Analyzed**: 2
- **Locations**: Garage, Vehicle - Exterior

I checked your recorded checkpoints, and there are currently **no kitchen issues**.`;

    const narrative = extractExecutiveSummaryNarrative(md, {
      omitCheckpointSummaryMarkdown: true,
    });
    expect(narrative).not.toContain("Checkpoints Analyzed");
    expect(narrative).toContain("no kitchen issues");
  });

  it("extracts executor prose glued to the last checkpoint summary bullet", () => {
    const md = `# Checkpoint analysis

## Checkpoint Summary
- **Property**: 1982 Helena Way
- **Overall Condition**: damaged, needs maintenanceThe analysis of the checkpoint from last year does not show any recorded issues for the kitchen.`;

    const narrative = extractExecutiveSummaryNarrative(md, {
      omitCheckpointSummaryMarkdown: true,
    });
    expect(narrative).not.toContain("damaged, needs maintenanceThe");
    expect(narrative).toContain("recorded issues for the kitchen");
  });

  it("returns empty when markdown is title only", () => {
    expect(
      extractExecutiveSummaryNarrative("# Garage Door Maintenance Analysis: 1982 Helena Way")
    ).toBe("");
  });
});

describe("getSummaryAccordionPreview", () => {
  it("prefers first Next Steps bullet", () => {
    const md = `# Summary

Overview prose here.

### Next Steps
1. **If DIY:** Prep the surface before priming.
2. Contact local contractors.`;

    expect(getSummaryAccordionPreview(md)).toBe(
      "If DIY: Prep the surface before priming."
    );
  });

  it("falls back to first prose line when no Next Steps section", () => {
    const md = `# Garage Door

Following the inspection, paint chipping was found.`;

    expect(getSummaryAccordionPreview(md)).toBe(
      "Following the inspection, paint chipping was found."
    );
  });

  it("truncates long preview with ellipsis", () => {
    const longLine = "A".repeat(200);
    const preview = getSummaryAccordionPreview(longLine, 50);
    expect(preview.length).toBeLessThanOrEqual(51);
    expect(preview.endsWith("…")).toBe(true);
  });
});

describe("summaryAccordionPreviewIsTruncated", () => {
  it("returns true when full markdown is much longer than preview", () => {
    const md = `# Title\n\n${"word ".repeat(80)}`;
    const preview = getSummaryAccordionPreview(md, 40);
    expect(summaryAccordionPreviewIsTruncated(md, preview)).toBe(true);
  });

  it("returns false for empty preview", () => {
    expect(summaryAccordionPreviewIsTruncated("some text", "")).toBe(false);
  });
});

describe("getCostEstimateRecommendation", () => {
  it("returns null when recommendation missing", () => {
    expect(getCostEstimateRecommendation({ repair_type: "Paint" })).toBeNull();
  });

  it("reads notes and next_steps", () => {
    expect(
      getCostEstimateRecommendation({
        recommendation: {
          notes: "Consider skill level.",
          next_steps: "Obtain multiple local quotes.",
        },
      })
    ).toEqual({
      notes: "Consider skill level.",
      next_steps: "Obtain multiple local quotes.",
    });
  });
});
