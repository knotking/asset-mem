import { extractExecutiveSummaryNarrative } from '@homeapp/common/lib/executive-summary-display';
import { resolveMessageContentParts } from '@homeapp/common/lib/message-content-parts';
import { normalizeChatMarkdownSpacing } from '@homeapp/common/lib/normalize-chat-markdown';
import { serviceSearchFailed } from '@homeapp/common/lib/service-search-status';
import type { Message, StructuredResponseData } from '@homeapp/common/types';

export type MessageDisplayParts = {
  structuredData: StructuredResponseData | null;
  markdown: string;
  /** Narrative prose (overview, recommendations) shown above accordions. */
  summaryMarkdown: string;
};

function checkpointSummaryHasVisibleData(
  checkpointSummary: NonNullable<StructuredResponseData['analysis']>['checkpointSummary']
): boolean {
  if (!checkpointSummary) return false;
  if (
    typeof checkpointSummary.checkpointsAnalyzed === 'number' &&
    checkpointSummary.checkpointsAnalyzed > 0
  ) {
    return true;
  }
  if (checkpointSummary.issuesDetected && checkpointSummary.issuesDetected.length > 0) {
    return true;
  }
  if (checkpointSummary.overallCondition?.trim()) return true;
  if (checkpointSummary.locations && checkpointSummary.locations.length > 0) return true;
  return false;
}

function triageHasVisibleData(
  triage: Record<string, unknown> | null | undefined
): boolean {
  if (!triage || typeof triage !== 'object') return false;
  if (triage.needs_clarification === true) {
    const questions = triage.clarification_questions;
    if (Array.isArray(questions) && questions.length > 0) return true;
    const message = triage.message;
    if (typeof message === 'string' && message.trim()) return true;
  }
  const diagnosis = triage.diagnosis;
  return typeof diagnosis === 'string' && diagnosis.trim() !== '';
}

/** True when structured JSON has at least one section the UI can render (not an empty shell). */
export function structuredDataHasVisibleSections(data: StructuredResponseData): boolean {
  const analysis = data.analysis || ({} as NonNullable<StructuredResponseData['analysis']>);
  const analysisRecord = analysis as Record<string, unknown>;
  const rootRecord = data as Record<string, unknown>;

  const triage = (analysis?.triageResult || rootRecord.triageResult) as
    | Record<string, unknown>
    | undefined;
  if (triageHasVisibleData(triage)) return true;

  if (checkpointSummaryHasVisibleData(analysis?.checkpointSummary)) return true;

  const checkpointDetails = analysisRecord.checkpointDetails;
  if (Array.isArray(checkpointDetails) && checkpointDetails.length > 0) return true;

  const insights = analysisRecord.insights;
  if (insights && typeof insights === 'object') {
    const insightRecord = insights as Record<string, unknown>;
    if (insightRecord.changes || insightRecord.patterns || insightRecord.recommendations) {
      return true;
    }
  }

  const coverage = analysis?.coverageResult || rootRecord.coverageResult;
  const coverageRecord = coverage as Record<string, unknown> | undefined;
  if (coverageRecord && (coverageRecord.warrantyInfo || coverageRecord.insuranceInfo)) {
    return true;
  }

  const diy = analysis?.diyResults || rootRecord.diyResults;
  const diyRecord = diy as Record<string, unknown> | undefined;
  if (diyRecord) {
    const diySteps = diyRecord.diySteps as Record<string, unknown> | undefined;
    const youtubeSearch = diyRecord.youtubeSearch as Record<string, unknown> | undefined;
    const recommendedProducts = diyRecord.recommendedProducts as Record<string, unknown> | undefined;
    if (
      diyRecord.hireProfessionalRecommended === true ||
      diyRecord.hire_professional_recommended === true ||
      (typeof diySteps?.summary === 'string' && diySteps.summary.trim()) ||
      (Array.isArray(diySteps?.steps) && diySteps.steps.length > 0) ||
      (Array.isArray(youtubeSearch?.videos) && youtubeSearch.videos.length > 0) ||
      (Array.isArray(recommendedProducts?.products) && recommendedProducts.products.length > 0)
    ) {
      return true;
    }
  }

  const service = analysis?.serviceResults || rootRecord.serviceResults;
  const serviceRecord = service as Record<string, unknown> | undefined;
  if (serviceRecord) {
    const localPros = serviceRecord.localPros as Record<string, unknown> | undefined;
    const providerArrays = [
      localPros?.yelpAPIResults,
      localPros?.serpAPIResults,
      localPros?.googleSearchResults,
      serviceRecord.providers,
      serviceRecord.localProviders,
      serviceRecord.local_pros,
      serviceRecord.results,
      serviceRecord.nearbyProviders,
    ];
    if (providerArrays.some((arr) => Array.isArray(arr) && arr.length > 0)) return true;
    if (serviceSearchFailed(serviceRecord)) return true;
  }

  const costEstimation = rootRecord.costEstimationResults || analysisRecord.costEstimationResults;
  const costRecord = costEstimation as Record<string, unknown> | undefined;
  if (costRecord?.costEstimates) return true;

  return false;
}

function synthesisMarkdownForSummary(message: Message): string {
  if (typeof message.contentMarkdown === 'string' && message.contentMarkdown.trim()) {
    return normalizeChatMarkdownSpacing(message.contentMarkdown);
  }
  const content = typeof message.content === 'string' ? message.content.trim() : '';
  if (!content || content.startsWith('{') || content.startsWith('[')) {
    return '';
  }
  return normalizeChatMarkdownSpacing(content);
}

/** Resolve structured vs markdown display from contentJson + contentMarkdown fields. */
export function getMessageDisplayParts(message: Message): MessageDisplayParts {
  const { markdown, contentJson } = resolveMessageContentParts(message);
  if (contentJson && structuredDataHasVisibleSections(contentJson)) {
    const analysis = contentJson.analysis;
    const omitCheckpointSummaryMarkdown = checkpointSummaryHasVisibleData(
      analysis?.checkpointSummary
    );
    return {
      structuredData: contentJson,
      markdown: '',
      summaryMarkdown: extractExecutiveSummaryNarrative(
        synthesisMarkdownForSummary(message),
        { omitCheckpointSummaryMarkdown }
      ),
    };
  }
  return { structuredData: null, markdown, summaryMarkdown: '' };
}

/** Whether assistant message parts should render content (vs typing / agent status). */
export function assistantMessageHasDisplayableContent(parts: MessageDisplayParts): boolean {
  if (parts.structuredData) {
    return structuredDataHasVisibleSections(parts.structuredData);
  }
  return !!parts.markdown?.trim();
}
