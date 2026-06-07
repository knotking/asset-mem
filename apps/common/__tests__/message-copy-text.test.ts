import type { Message } from "../src/types";
import {
  buildAssistantMessageCopyText,
  buildStructuredResponseCopyText,
} from "../src/lib/message-copy-text";

describe("message-copy-text", () => {
  it("returns markdown for plain assistant messages", () => {
    const message = {
      id: "m1",
      role: "assistant",
      content: "",
      contentMarkdown: "Hello **world**",
    } as Message;

    expect(buildAssistantMessageCopyText(message)).toBe("Hello **world**");
  });

  it("exports structured accordion sections as plain text", () => {
    const text = buildStructuredResponseCopyText(
      {
        analysis: {
          title: "Roof leak assessment",
          checkpointSummary: {
            checkpointsAnalyzed: 2,
            overallCondition: "fair",
            issuesDetected: ["Missing shingle", "Flashing gap"],
          },
          diyResults: {
            diySteps: {
              summary: "Patch small areas after dry weather.",
              steps: [{ stepNumber: 1, description: "Inspect attic for stains." }],
            },
          },
          serviceResults: {
            localPros: {
              serpAPIResults: [
                {
                  name: "Ace Roofing",
                  contact_info: "555-0100",
                  location: "Austin, TX",
                  ratings: "4.8",
                  reviews: "120",
                  directions: null,
                  website: null,
                  authorized: "",
                  additional_information: "",
                },
              ],
            },
          },
          costEstimationResults: {
            costEstimates: {
              repair_type: "Shingle repair",
              DIY: { cost_range: "$50–$150", complexity: "Moderate" },
              Service: { cost_range: "$300–$600" },
            },
          },
        },
      },
      "## Overview\nPatch soon.\n\n## Checkpoint Summary\nDuplicate prose."
    );

    expect(text).toContain("*Roof leak assessment*");
    expect(text).toContain("*Checkpoint Summary*");
    expect(text).toContain("Missing shingle");
    expect(text).toContain("*DIY Recommendations*");
    expect(text).toContain("Inspect attic for stains.");
    expect(text).toContain("*Service Recommendations*");
    expect(text).toContain("Ace Roofing");
    expect(text).toContain("*Cost Estimates*");
    expect(text).toContain("Shingle repair");
    expect(text).toContain("Patch soon.");
    expect(text).not.toContain("Duplicate prose.");
  });

  it("uses structured export for assistant messages with contentJson", () => {
    const message = {
      id: "m2",
      role: "assistant",
      content: "",
      contentMarkdown: "## Overview\nSummary text.",
      contentJson: {
        analysis: {
          title: "Garage door noise",
          triageResult: { diagnosis: "Worn rollers likely." },
        },
      },
    } as Message;

    const text = buildAssistantMessageCopyText(message);
    expect(text).toContain("*Garage door noise*");
    expect(text).toContain("*Diagnosis*");
    expect(text).toContain("Worn rollers likely.");
  });

  it("markdown format uses link syntax and headings", () => {
    const text = buildStructuredResponseCopyText(
      {
        analysis: {
          title: "Leak",
          serviceResults: {
            localPros: {
              serpAPIResults: [
                {
                  name: "Pro Fix",
                  contact_info: "555",
                  location: "Austin",
                  ratings: "5",
                  reviews: "1",
                  website: "https://pro.example",
                  directions: "",
                  link: "",
                  authorized: "",
                  additional_information: "",
                },
              ],
            },
          },
        },
      },
      "",
      "markdown"
    );
    expect(text).toContain("# Leak");
    expect(text).toContain("[Website](https://pro.example)");
  });
});
