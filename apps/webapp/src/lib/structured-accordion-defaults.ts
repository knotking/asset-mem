/**
 * Structured accordion open-state defaults — based on
 * apps/common/src/lib/structured-accordion-defaults.ts; web platform keeps
 * sections collapsed by default (checkpoint summary is a standalone card).
 */

import { EXECUTIVE_SUMMARY_ACCORDION_VALUE } from "@/lib/executive-summary-display";

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
 * Collapse optional-section defaults while pipeline branches or synthesis run
 * and checkpoint summary JSON is not yet available.
 */
export function structuredAccordionsCollapsed(
  visibility: Pick<
    StructuredAccordionVisibility,
    "analysisInProgress" | "hasCheckpointSummary"
  >
): boolean {
  return !!visibility.analysisInProgress && !visibility.hasCheckpointSummary;
}

/**
 * Initial expanded accordion for structured checkpoint messages.
 * Web: all sections collapsed by default (checkpoint summary is a standalone card).
 * Native (ios/android): checkpoint summary accordion opens when structured data arrives.
 */
export function getStructuredAccordionDefaultValue(
  visibility: StructuredAccordionVisibility,
  platform: StructuredAccordionPlatform = "web"
): StructuredAccordionSection | undefined {
  if (visibility.needsClarification) {
    return "triage";
  }

  if (platform === "web") {
    return undefined;
  }

  if (visibility.hasCheckpointSummary) {
    return "checkpoint-summary";
  }

  if (structuredAccordionsCollapsed(visibility)) {
    return undefined;
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
