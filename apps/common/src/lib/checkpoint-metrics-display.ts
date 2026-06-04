import type { PropertyCheckpointMetrics } from '../types';

/** Resolved headline score for UI (v2 headline or v1 latest_score). */
export function getMetricsHeadlineScore(
  metrics: PropertyCheckpointMetrics | null | undefined
): number | null {
  if (!metrics?.overall) return null;
  const headline = metrics.overall.headline?.value;
  if (typeof headline === 'number' && Number.isFinite(headline)) {
    return headline;
  }
  const legacy = metrics.overall.latest_score;
  if (typeof legacy === 'number' && Number.isFinite(legacy)) {
    return legacy;
  }
  return null;
}

export function getMetricsStatus(
  metrics: PropertyCheckpointMetrics | null | undefined
): PropertyCheckpointMetrics['status'] {
  if (metrics?.status) return metrics.status;
  if (!metrics?.overall) return undefined;
  const score = getMetricsHeadlineScore(metrics);
  if (score === null) return 'pending_analysis';
  return 'ready';
}

export function formatMetricsHeadlineDisplay(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return '—';
  return String(Math.round(Math.max(0, Math.min(100, score))));
}

export type InsightsViewState = 'loading' | 'missing_summary' | 'ready';

/** Distinguish Firestore doc missing vs loaded summary (always-write contract). */
export function resolveInsightsViewState(options: {
  loading: boolean;
  summaryExists: boolean;
}): InsightsViewState {
  if (options.loading) return 'loading';
  if (!options.summaryExists) return 'missing_summary';
  return 'ready';
}

export const INSIGHTS_MISSING_SUMMARY_MESSAGE =
  'Property insights will appear after checkpoint analysis finishes and syncs to this property.';

export const INSIGHTS_MISSING_SUMMARY_HINT =
  'If you already analyzed checkpoints, wait a moment or pull to refresh.';
