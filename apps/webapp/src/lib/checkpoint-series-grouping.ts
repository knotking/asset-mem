import type { Checkpoint } from "@/lib/types";
import {
  makeSeriesId,
  normalizeSeriesLocation,
  seriesDisplayName,
} from "@/lib/checkpoint-series";
import { checkpointEffectiveDate } from "@/lib/report-resolve";

export type CheckpointSeriesGroup = {
  seriesId: string;
  label: string;
  location?: string;
  captureCount: number;
  latestCapture: Checkpoint;
  captures: Checkpoint[];
};

function captureSortKey(cp: Checkpoint): number {
  if (cp.revisionNumber != null) {
    return cp.revisionNumber;
  }
  const date = checkpointEffectiveDate(cp);
  return date ? date.getTime() : 0;
}

/** Sort captures newest-first (highest revision, then newest date). */
export function sortCapturesNewestFirst(captures: Checkpoint[]): Checkpoint[] {
  return [...captures].sort((a, b) => {
    const revDiff = captureSortKey(b) - captureSortKey(a);
    if (revDiff !== 0) {
      return revDiff;
    }
    const dateA = checkpointEffectiveDate(a)?.getTime() ?? 0;
    const dateB = checkpointEffectiveDate(b)?.getTime() ?? 0;
    return dateB - dateA;
  });
}

/**
 * Group checkpoints by seriesId. Legacy captures without seriesId each form
 * their own single-item group keyed by checkpoint id.
 */
export function groupCheckpointsBySeries(
  checkpoints: Checkpoint[]
): CheckpointSeriesGroup[] {
  const bySeries = new Map<string, Checkpoint[]>();

  for (const cp of checkpoints) {
    const key = cp.seriesId ?? `legacy-${cp.id}`;
    const list = bySeries.get(key) ?? [];
    list.push(cp);
    bySeries.set(key, list);
  }

  const groups: CheckpointSeriesGroup[] = [];

  for (const [seriesId, captures] of bySeries) {
    const sorted = sortCapturesNewestFirst(captures);
    const latest = sorted[0];
    groups.push({
      seriesId,
      label: seriesDisplayName(latest.location, latest.name),
      location: latest.location,
      captureCount: sorted.length,
      latestCapture: latest,
      captures: sorted,
    });
  }

  groups.sort((a, b) => {
    const dateA = checkpointEffectiveDate(a.latestCapture)?.getTime() ?? 0;
    const dateB = checkpointEffectiveDate(b.latestCapture)?.getTime() ?? 0;
    return dateB - dateA;
  });

  return groups;
}

/** Prior capture in the same series (revision N-1), if any. */
export function findPreviousCaptureInList(
  checkpoints: Checkpoint[],
  capture: Checkpoint
): Checkpoint | undefined {
  if (!capture.seriesId || capture.revisionNumber == null) {
    return undefined;
  }
  if (capture.revisionNumber <= 1) {
    return undefined;
  }
  return checkpoints.find(
    (c) =>
      c.seriesId === capture.seriesId &&
      c.revisionNumber === capture.revisionNumber! - 1
  );
}

export type SeriesCapturePrediction = {
  seriesId: string;
  nextRevision: number;
  label: string;
  existingCount: number;
};

/** Hint for create UI: next capture number when location matches an existing series. */
export function predictSeriesCaptureAssignment(
  checkpoints: Checkpoint[],
  params: { location?: string; name?: string }
): SeriesCapturePrediction | null {
  const locationKey = normalizeSeriesLocation(params.location || params.name);
  if (locationKey === "unspecified") {
    return null;
  }

  const seriesId = makeSeriesId(locationKey);
  const inSeries = checkpoints.filter(
    (cp) =>
      cp.seriesId === seriesId ||
      (!cp.seriesId &&
        normalizeSeriesLocation(cp.location || cp.name) === locationKey)
  );

  if (inSeries.length === 0) {
    return null;
  }

  const maxRev = Math.max(
    ...inSeries.map((c) => c.revisionNumber ?? inSeries.length)
  );

  return {
    seriesId,
    nextRevision: maxRev + 1,
    label: seriesDisplayName(params.location, params.name),
    existingCount: inSeries.length,
  };
}

export function formatCaptureRevisionLabel(checkpoint: Checkpoint): string | null {
  if (checkpoint.revisionNumber == null) {
    return null;
  }
  const rev = checkpoint.revisionNumber;
  if (checkpoint.isLatestInSeries !== false) {
    return rev === 1 ? "First capture" : `Latest · v${rev}`;
  }
  return `v${rev}`;
}
