import type { StructuredResponseData } from '@homeapp/common/types';

export type ExtractedContentParts = {
  structuredData: StructuredResponseData | null;
  markdownContent: string;
};

/** Keys aligned with checkpoint dual-format analysis (see analysis_has_structured_ui_sections). */
const STRUCTURED_ANALYSIS_KEYS = [
  'coverageResult',
  'diyResults',
  'serviceResults',
  'costEstimationResults',
  'checkpointDetails',
  'insights',
] as const;

function analysisHasStructuredKeys(analysis: Record<string, unknown>): boolean {
  for (const key of STRUCTURED_ANALYSIS_KEYS) {
    if (analysis[key]) return true;
  }
  return !!analysis.checkpointSummary || !!analysis.triageResult;
}

function hasStructuredDataKeys(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as Record<string, unknown>;
  if (p.analysis && typeof p.analysis === 'object') {
    return analysisHasStructuredKeys(p.analysis as Record<string, unknown>);
  }
  for (const key of STRUCTURED_ANALYSIS_KEYS) {
    if (p[key]) return true;
  }
  return !!p.checkpointSummary || !!p.triageResult;
}

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
  }

  const costEstimation = rootRecord.costEstimationResults || analysisRecord.costEstimationResults;
  const costRecord = costEstimation as Record<string, unknown> | undefined;
  if (costRecord?.costEstimates) return true;

  return false;
}

function acceptStructuredPayload(parsed: unknown): parsed is StructuredResponseData {
  return (
    hasStructuredDataKeys(parsed) &&
    structuredDataHasVisibleSections(parsed as StructuredResponseData)
  );
}

function structuredOrMarkdown(
  parsed: StructuredResponseData,
  markdownContent: string
): ExtractedContentParts {
  if (acceptStructuredPayload(parsed)) {
    return { structuredData: parsed, markdownContent };
  }
  const md = markdownContent.trim();
  // Dual-format: keep markdown body while JSON is still streaming.
  if (md) {
    return { structuredData: null, markdownContent: md };
  }
  // JSON-only shells must not surface as markdown (avoids raw JSON in the bubble).
  return { structuredData: null, markdownContent: '' };
}

/** Whether assistant message parts should render content (vs typing / agent status). */
export function assistantMessageHasDisplayableContent(
  extracted: ExtractedContentParts
): boolean {
  if (extracted.structuredData) {
    return structuredDataHasVisibleSections(extracted.structuredData);
  }
  return !!extracted.markdownContent?.trim();
}

/** Extract markdown and structured JSON from assistant message content. */
export function extractContentParts(
  content: string,
  isUser: boolean
): ExtractedContentParts {
  if (isUser || !content) {
    return { structuredData: null, markdownContent: content };
  }

  try {
    const contentToParse = content.trim();

    let combinedMatch = contentToParse.match(
      /```markdown\s*\n([\s\S]*?)\n```\s*\n?```json\s*\n([\s\S]*?)\n```/
    );

    if (!combinedMatch) {
      combinedMatch = contentToParse.match(
        /```markdown\s*\n([\s\S]*?)```\s*\n?```json\s*\n([\s\S]*?)```/
      );
    }

    if (combinedMatch) {
      const markdownText = combinedMatch[1].trim();
      const jsonStr = combinedMatch[2].trim();

      try {
        const parsed = JSON.parse(jsonStr);
        const preMarkdownText = contentToParse
          .substring(0, contentToParse.indexOf(combinedMatch[0]))
          .trim();
        const fullMarkdownContent = preMarkdownText
          ? `${preMarkdownText}\n\n${markdownText}`
          : markdownText;
        const accepted = structuredOrMarkdown(parsed as StructuredResponseData, fullMarkdownContent);
        if (accepted.structuredData || accepted.markdownContent) return accepted;
      } catch {
        // Failed to parse JSON from combined blocks
      }
    }

    const jsonMatch = contentToParse.match(/```json\s*\n?([\s\S]*?)```/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1].trim();
      try {
        const parsed = JSON.parse(jsonStr);
        const markdownContent = contentToParse.replace(jsonMatch[0], '').trim();
        const accepted = structuredOrMarkdown(parsed as StructuredResponseData, markdownContent);
        if (accepted.structuredData || accepted.markdownContent) return accepted;
      } catch {
        // Failed to parse JSON from code block
      }
    }

    const anyCodeBlockMatch = contentToParse.match(/```\s*\n?([\s\S]*?)```/);

    if (anyCodeBlockMatch) {
      const codeBlockContent = anyCodeBlockMatch[1].trim();
      try {
        const parsed = JSON.parse(codeBlockContent);
        const markdownContent = contentToParse.replace(anyCodeBlockMatch[0], '').trim();
        const accepted = structuredOrMarkdown(parsed as StructuredResponseData, markdownContent);
        if (accepted.structuredData || accepted.markdownContent) return accepted;
      } catch {
        // Not JSON, continue
      }
    }

    try {
      const parsed = JSON.parse(contentToParse);
      if (typeof parsed === 'object' && parsed !== null) {
        return structuredOrMarkdown(parsed as StructuredResponseData, '');
      }
    } catch {
      // Not valid JSON, treat as plain markdown
    }
  } catch {
    // Error in content parsing
  }

  return { structuredData: null, markdownContent: content };
}
