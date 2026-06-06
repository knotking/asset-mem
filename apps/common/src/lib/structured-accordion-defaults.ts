import {
  EXECUTIVE_SUMMARY_ACCORDION_VALUE,
} from "./executive-summary-display";

export type StructuredAccordionSection =
  | "triage"
  | "checkpoint-summary"
  | "checkpoint-details"
  | "checkpoint-insights"
  | "coverage"
  | "diy"
  | "service"
  | "cost-estimates"
  | typeof EXECUTIVE_SUMMARY_ACCORDION_VALUE;

export type StructuredAccordionVisibility = {
  needsClarification?: boolean;
  hasSummaryMarkdown?: boolean;
  analysisInProgress?: boolean;
  hasCheckpointSummary?: boolean;
  hasCheckpointDetails?: boolean;
  hasCheckpointInsights?: boolean;
  hasCoverage?: boolean;
  hasDIY?: boolean;
  hasService?: boolean;
  hasCostEstimates?: boolean;
};

export type StructuredAccordionPlatform = "ios" | "android" | "web";

/**
 * Collapsed sentinel for native single-select accordions (`@rn-primitives/accordion`).
 * Do not use `undefined` as the controlled `value` — the primitive treats that as
 * uncontrolled and keeps stale internal state (first collapse shows preview + content).
 */
export const STRUCTURED_ACCORDION_COLLAPSED = "__collapsed__";

/**
 * Collapse structured accordions while optional branches or synthesis are still running.
 * Do not tie this to the client stream alone — checkpoint-only turns should open
 * Checkpoint Summary as soon as structured content is visible.
 */
export function structuredAccordionsCollapsed(
  visibility: Pick<StructuredAccordionVisibility, "analysisInProgress">
): boolean {
  return !!visibility.analysisInProgress;
}

/**
 * Initial expanded accordion for structured checkpoint messages.
 * While `analysisInProgress` (pipeline branches / synthesis), all sections stay collapsed.
 * Summary & Next Steps stays collapsed by default (preview in trigger).
 */
export function getStructuredAccordionDefaultValue(
  visibility: StructuredAccordionVisibility,
  platform: StructuredAccordionPlatform = "web"
): StructuredAccordionSection | undefined {
  if (visibility.needsClarification) {
    return "triage";
  }

  if (structuredAccordionsCollapsed(visibility)) {
    return undefined;
  }

  if (visibility.hasSummaryMarkdown) {
    return undefined;
  }

  if (visibility.hasCheckpointSummary) {
    return "checkpoint-summary";
  }

  if (platform === "android") {
    return undefined;
  }

  if (visibility.hasCheckpointDetails) {
    return "checkpoint-details";
  }
  if (visibility.hasCheckpointInsights) {
    return "checkpoint-insights";
  }
  if (visibility.hasCoverage) {
    return "coverage";
  }
  if (visibility.hasDIY) {
    return "diy";
  }
  if (visibility.hasService) {
    return "service";
  }
  if (visibility.hasCostEstimates) {
    return "cost-estimates";
  }

  return undefined;
}
