import type { PropertyReport } from '@/lib/types';

export function reportRangeBound(value: unknown): string | undefined {
  if (typeof value === 'string') return value.slice(0, 10);
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return undefined;
}

export function snapshotRangeFromReport(
  report: PropertyReport
): { start: string; end: string } | null {
  const range = report.snapshotRange;
  if (!range) return null;
  const start = reportRangeBound(range.start);
  const end = reportRangeBound(range.end);
  if (!start || !end) return null;
  return { start, end };
}

export function comparisonRangesFromReport(report: PropertyReport): {
  baselineRange: { start: string; end: string };
  comparisonRange: { start: string; end: string };
} | null {
  const baseline = report.baselineRange;
  const comparison = report.comparisonRange;
  if (!baseline || !comparison) return null;
  const bStart = reportRangeBound(baseline.start);
  const bEnd = reportRangeBound(baseline.end);
  const cStart = reportRangeBound(comparison.start);
  const cEnd = reportRangeBound(comparison.end);
  if (!bStart || !bEnd || !cStart || !cEnd) return null;
  return {
    baselineRange: { start: bStart, end: bEnd },
    comparisonRange: { start: cStart, end: cEnd },
  };
}
