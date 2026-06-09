/** Mirrored from @homeapp/common — webapp cannot import common (App Hosting). */
import type { Timestamp } from 'firebase/firestore';
import type {
  Checkpoint,
  ReportPreviewCheckpoint,
  ReportPreviewResponse,
  PropertyReportPurpose,
} from '@/lib/types';
import type { ReportComparisonDateRanges, ReportSnapshotDateRange } from '@/lib/report-preview';
import {
  comparisonLowPairRateWarning,
  rentalSinglePhotoWarning,
} from '@/lib/report-wizard';

const COMPARISON_PAIR_RATE_WARN_THRESHOLD = 0.5;

export function parseReportIsoDate(value: string, endOfDay = false): Date {
  const raw = value.trim();
  if (!raw) {
    throw new Error('Date is required');
  }
  if (raw.includes('T')) {
    return new Date(raw);
  }
  const [year, month, day] = raw.split('-').map(Number);
  if (endOfDay) {
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function checkpointEffectiveDate(
  cp: Pick<Checkpoint, 'capturedAt' | 'createdAt'>
): Date | null {
  for (const key of ['capturedAt', 'createdAt'] as const) {
    const raw = cp[key];
    if (raw == null) continue;
    if (typeof (raw as Timestamp).toDate === 'function') {
      return (raw as Timestamp).toDate();
    }
    if (raw instanceof Date) {
      return raw;
    }
    if (typeof raw === 'string') {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  return null;
}

export function normalizeReportLocation(location?: string): string {
  const normalized = (location ?? 'unspecified').trim().toLowerCase();
  return normalized || 'unspecified';
}

function displayLocation(cp: Checkpoint, normalizedLoc: string): string {
  const raw = (cp.location ?? '').trim();
  return raw || normalizedLoc;
}

function toPreviewCheckpoint(cp: Checkpoint): ReportPreviewCheckpoint {
  const captured = checkpointEffectiveDate(cp);
  return {
    checkpointId: cp.id,
    name: cp.name || 'Checkpoint',
    location: cp.location,
    analysisStatus: cp.analysisStatus,
    capturedAt: captured?.toISOString(),
  };
}

export function collectCheckpointsInRange(
  checkpoints: Checkpoint[],
  dateRange: ReportSnapshotDateRange
): Checkpoint[] {
  const start = parseReportIsoDate(dateRange.start);
  const end = parseReportIsoDate(dateRange.end, true);
  return checkpoints.filter((cp) => {
    const effective = checkpointEffectiveDate(cp);
    if (!effective) return false;
    return effective >= start && effective <= end;
  });
}

export function pickLatestCheckpointPerLocation(
  checkpoints: Checkpoint[]
): Map<string, Checkpoint> {
  const byLocation = new Map<string, Checkpoint>();
  for (const cp of checkpoints) {
    const loc = normalizeReportLocation(cp.location);
    const existing = byLocation.get(loc);
    if (!existing) {
      byLocation.set(loc, cp);
      continue;
    }
    const existingDt =
      checkpointEffectiveDate(existing)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const cpDt = checkpointEffectiveDate(cp)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const existingConf = existing.assetConfidence ?? 0;
    const cpConf = cp.assetConfidence ?? 0;
    if (cpDt > existingDt || (cpDt === existingDt && cpConf > existingConf)) {
      byLocation.set(loc, cp);
    }
  }
  return byLocation;
}

function sortCheckpointsByDate(checkpoints: Checkpoint[]): Checkpoint[] {
  return [...checkpoints].sort((a, b) => {
    const aDt = checkpointEffectiveDate(a)?.getTime() ?? 0;
    const bDt = checkpointEffectiveDate(b)?.getTime() ?? 0;
    if (aDt !== bDt) return aDt - bDt;
    return (b.assetConfidence ?? 0) - (a.assetConfidence ?? 0);
  });
}

export type ComparisonResolution = {
  pairs: Array<{
    location: string;
    baselineCheckpointId: string;
    comparisonCheckpointId: string;
    baseline?: ReportPreviewCheckpoint;
    comparison?: ReportPreviewCheckpoint;
  }>;
  baselineOnly: ReportPreviewCheckpoint[];
  comparisonOnly: ReportPreviewCheckpoint[];
};

export function resolveComparisonFromCheckpoints(
  checkpoints: Checkpoint[],
  baselineRange: ReportSnapshotDateRange,
  comparisonRange: ReportSnapshotDateRange
): ComparisonResolution {
  const baselineInRange = collectCheckpointsInRange(checkpoints, baselineRange);
  const comparisonInRange = collectCheckpointsInRange(checkpoints, comparisonRange);
  if (baselineInRange.length === 0 && comparisonInRange.length === 0) {
    throw new Error('No checkpoints in the selected date ranges');
  }

  const baselineLatest = pickLatestCheckpointPerLocation(baselineInRange);
  const comparisonLatest = pickLatestCheckpointPerLocation(comparisonInRange);
  const locations = new Set([...baselineLatest.keys(), ...comparisonLatest.keys()]);

  const pairs: ComparisonResolution['pairs'] = [];
  const baselineOnly: ReportPreviewCheckpoint[] = [];
  const comparisonOnly: ReportPreviewCheckpoint[] = [];

  for (const loc of [...locations].sort()) {
    const baselineCp = baselineLatest.get(loc);
    const comparisonCp = comparisonLatest.get(loc);
    if (baselineCp && comparisonCp) {
      pairs.push({
        location: displayLocation(baselineCp, loc),
        baselineCheckpointId: baselineCp.id,
        comparisonCheckpointId: comparisonCp.id,
        baseline: toPreviewCheckpoint(baselineCp),
        comparison: toPreviewCheckpoint(comparisonCp),
      });
    } else if (baselineCp) {
      baselineOnly.push(toPreviewCheckpoint(baselineCp));
    } else if (comparisonCp) {
      comparisonOnly.push(toPreviewCheckpoint(comparisonCp));
    }
  }

  return { pairs, baselineOnly, comparisonOnly };
}

/** Rental move-in/out: one tenancy window; earliest vs latest checkpoint per location. */
export function resolveRentalComparisonFromCheckpoints(
  checkpoints: Checkpoint[],
  tenancyRange: ReportSnapshotDateRange
): ComparisonResolution {
  const inRange = collectCheckpointsInRange(checkpoints, tenancyRange);
  if (inRange.length === 0) {
    throw new Error('No checkpoints in the selected date ranges');
  }

  const byLocation = new Map<string, Checkpoint[]>();
  for (const cp of inRange) {
    const loc = normalizeReportLocation(cp.location);
    const list = byLocation.get(loc) ?? [];
    list.push(cp);
    byLocation.set(loc, list);
  }

  const pairs: ComparisonResolution['pairs'] = [];
  const baselineOnly: ReportPreviewCheckpoint[] = [];
  const comparisonOnly: ReportPreviewCheckpoint[] = [];

  for (const loc of [...byLocation.keys()].sort()) {
    const sorted = sortCheckpointsByDate(byLocation.get(loc) ?? []);
    if (sorted.length >= 2) {
      const earliest = sorted[0];
      const latest = sorted[sorted.length - 1];
      if (earliest.id === latest.id) {
        baselineOnly.push(toPreviewCheckpoint(earliest));
        continue;
      }
      pairs.push({
        location: displayLocation(earliest, loc),
        baselineCheckpointId: earliest.id,
        comparisonCheckpointId: latest.id,
        baseline: toPreviewCheckpoint(earliest),
        comparison: toPreviewCheckpoint(latest),
      });
    } else if (sorted[0]) {
      baselineOnly.push(toPreviewCheckpoint(sorted[0]));
    }
  }

  return { pairs, baselineOnly, comparisonOnly };
}

export function comparisonResolutionWarnings(
  resolution: ComparisonResolution,
  purpose: PropertyReportPurpose = 'custom'
): string[] {
  const beforeLabel =
    purpose === 'rental_security' ? 'move-in period' : 'earlier period';
  const afterLabel =
    purpose === 'rental_security' ? 'move-out period' : 'later period';
  const warnings: string[] = [];
  const paired = resolution.pairs.length;
  const unpaired = resolution.baselineOnly.length + resolution.comparisonOnly.length;
  const total = paired + unpaired;
  const rate = total === 0 ? 0 : paired / total;

  if (rate < COMPARISON_PAIR_RATE_WARN_THRESHOLD) {
    warnings.push(comparisonLowPairRateWarning(rate, purpose));
  }
  if (resolution.baselineOnly.length > 0) {
    warnings.push(
      purpose === 'rental_security'
        ? rentalSinglePhotoWarning(resolution.baselineOnly.length)
        : `${resolution.baselineOnly.length} location(s) only in the ${beforeLabel}.`
    );
  }
  if (resolution.comparisonOnly.length > 0) {
    warnings.push(
      `${resolution.comparisonOnly.length} location(s) only in the ${afterLabel}.`
    );
  }
  return warnings;
}

export function resolveSnapshotPreviewFromCheckpoints(
  checkpoints: Checkpoint[],
  snapshotRange: ReportSnapshotDateRange
): ReportPreviewResponse {
  const inRange = collectCheckpointsInRange(checkpoints, snapshotRange);
  const latest = [...pickLatestCheckpointPerLocation(inRange).values()];
  return {
    mode: 'snapshot',
    checkpoints: latest.map(toPreviewCheckpoint),
    warnings: [],
  };
}

export function resolveComparisonPreviewFromCheckpoints(
  checkpoints: Checkpoint[],
  baselineRange: ReportSnapshotDateRange,
  comparisonRange: ReportSnapshotDateRange,
  purpose: PropertyReportPurpose = 'custom'
): ReportPreviewResponse {
  const resolution =
    purpose === 'rental_security'
      ? resolveRentalComparisonFromCheckpoints(checkpoints, baselineRange)
      : resolveComparisonFromCheckpoints(
          checkpoints,
          baselineRange,
          comparisonRange
        );
  return {
    mode: 'comparison',
    pairs: resolution.pairs,
    baselineOnly: resolution.baselineOnly,
    comparisonOnly: resolution.comparisonOnly,
    warnings: comparisonResolutionWarnings(resolution, purpose),
  };
}

export function oldestLoadedCheckpointDate(checkpoints: Checkpoint[]): Date | null {
  let oldest: Date | null = null;
  for (const cp of checkpoints) {
    const effective = checkpointEffectiveDate(cp);
    if (!effective) continue;
    if (!oldest || effective < oldest) {
      oldest = effective;
    }
  }
  return oldest;
}

/** True when every in-range checkpoint for these dates is present in `checkpoints`. */
export function snapshotRangeCoveredByLoadedCheckpoints(
  checkpoints: Checkpoint[],
  range: ReportSnapshotDateRange,
  hasMoreCheckpoints: boolean
): boolean {
  if (!hasMoreCheckpoints) {
    return true;
  }
  const oldest = oldestLoadedCheckpointDate(checkpoints);
  if (!oldest) {
    return false;
  }
  const rangeStart = parseReportIsoDate(range.start);
  return rangeStart.getTime() >= oldest.getTime();
}

export function canResolveReportPreviewLocally(
  checkpoints: Checkpoint[],
  options: {
    loading: boolean;
    hasMoreCheckpoints: boolean;
    mode: 'snapshot' | 'comparison';
    snapshotRange?: ReportSnapshotDateRange | null;
    comparisonRanges?: ReportComparisonDateRanges | null;
  }
): boolean {
  if (options.loading || checkpoints.length === 0) {
    return false;
  }
  if (options.mode === 'snapshot') {
    if (!options.snapshotRange) return false;
    return snapshotRangeCoveredByLoadedCheckpoints(
      checkpoints,
      options.snapshotRange,
      options.hasMoreCheckpoints
    );
  }
  if (!options.comparisonRanges) return false;
  const { baselineStart, baselineEnd, comparisonStart, comparisonEnd } =
    options.comparisonRanges;
  const sameSpan =
    baselineStart === comparisonStart && baselineEnd === comparisonEnd;
  if (sameSpan) {
    return snapshotRangeCoveredByLoadedCheckpoints(
      checkpoints,
      { start: baselineStart, end: baselineEnd },
      options.hasMoreCheckpoints
    );
  }
  return (
    snapshotRangeCoveredByLoadedCheckpoints(
      checkpoints,
      { start: baselineStart, end: baselineEnd },
      options.hasMoreCheckpoints
    ) &&
    snapshotRangeCoveredByLoadedCheckpoints(
      checkpoints,
      { start: comparisonStart, end: comparisonEnd },
      options.hasMoreCheckpoints
    )
  );
}

export function prepareReportPreviewFromCheckpoints(
  checkpoints: Checkpoint[],
  payload:
    | { mode: 'snapshot'; snapshotRange: ReportSnapshotDateRange }
    | {
        mode: 'comparison';
        baselineRange: ReportSnapshotDateRange;
        comparisonRange: ReportSnapshotDateRange;
        purpose?: PropertyReportPurpose;
      }
): ReportPreviewResponse {
  if (payload.mode === 'snapshot') {
    return resolveSnapshotPreviewFromCheckpoints(checkpoints, payload.snapshotRange);
  }
  return resolveComparisonPreviewFromCheckpoints(
    checkpoints,
    payload.baselineRange,
    payload.comparisonRange,
    payload.purpose
  );
}
