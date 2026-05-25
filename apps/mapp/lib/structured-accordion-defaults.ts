import { Platform } from 'react-native';

export type StructuredAccordionSection =
  | 'triage'
  | 'checkpoint-summary'
  | 'checkpoint-details'
  | 'checkpoint-insights'
  | 'coverage'
  | 'diy'
  | 'service'
  | 'cost-estimates';

export type StructuredAccordionVisibility = {
  /** Clarification questions UI (accordion value `triage`). */
  needsClarification?: boolean;
  hasCheckpointSummary?: boolean;
  hasCheckpointDetails?: boolean;
  hasCheckpointInsights?: boolean;
  hasCoverage?: boolean;
  hasDIY?: boolean;
  hasService?: boolean;
  hasCostEstimates?: boolean;
};

/**
 * Initial expanded accordion section for structured checkpoint messages.
 *
 * Android: only checkpoint summary (or clarification) starts open; optional-agent
 * sections (coverage, DIY, service, cost) stay collapsed to reduce JS work.
 *
 * iOS: checkpoint summary when present; otherwise first available content section.
 * Triage diagnosis is not used as a default (product no longer surfaces it).
 */
export function getStructuredAccordionDefaultValue(
  visibility: StructuredAccordionVisibility
): StructuredAccordionSection | undefined {
  if (visibility.needsClarification) {
    return 'triage';
  }

  if (visibility.hasCheckpointSummary) {
    return 'checkpoint-summary';
  }

  if (Platform.OS === 'android') {
    return undefined;
  }

  if (visibility.hasCheckpointDetails) {
    return 'checkpoint-details';
  }
  if (visibility.hasCheckpointInsights) {
    return 'checkpoint-insights';
  }
  if (visibility.hasCoverage) {
    return 'coverage';
  }
  if (visibility.hasDIY) {
    return 'diy';
  }
  if (visibility.hasService) {
    return 'service';
  }
  if (visibility.hasCostEstimates) {
    return 'cost-estimates';
  }

  return undefined;
}
