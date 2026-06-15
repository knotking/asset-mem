import type { Checkpoint } from "../types";
import {
  makeSeriesId,
  normalizeSeriesLocation,
  seriesDisplayName,
} from "./checkpoint-series";
import { checkpointEffectiveDate } from "./report-resolve";

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

export type SeriesReassignTarget = {
  seriesId: string;
  label: string;
  location: string;
  captureCount: number;
  latestCaptureLabel: string;
  latestCaptureAt?: Date;
  /** Same normalized location as this capture — likely duplicate monitoring point. */
  isSuggestedMatch: boolean;
};

/** Existing series a capture can be moved into (excludes its current series). */
export function listSeriesReassignTargets(
  checkpoints: Checkpoint[],
  current: Checkpoint
): SeriesReassignTarget[] {
  const currentLocationKey = normalizeSeriesLocation(
    current.location || current.name
  );

  return groupCheckpointsBySeries(checkpoints)
    .filter((group) => group.seriesId !== current.seriesId)
    .map((group) => {
      const groupLocationKey = normalizeSeriesLocation(
        group.location || group.latestCapture.location || group.label
      );
      return {
        seriesId: group.seriesId,
        label: group.label,
        location: group.location || group.label,
        captureCount: group.captureCount,
        latestCaptureLabel: group.latestCapture.name,
        latestCaptureAt: checkpointEffectiveDate(group.latestCapture) ?? undefined,
        isSuggestedMatch:
          currentLocationKey !== "unspecified" &&
          groupLocationKey === currentLocationKey,
      };
    })
    .sort((a, b) => {
      if (a.isSuggestedMatch !== b.isSuggestedMatch) {
        return a.isSuggestedMatch ? -1 : 1;
      }
      const dateA = a.latestCaptureAt?.getTime() ?? 0;
      const dateB = b.latestCaptureAt?.getTime() ?? 0;
      return dateB - dateA;
    });
}

export function hasSuggestedMergeTargets(
  checkpoints: Checkpoint[],
  current: Checkpoint
): boolean {
  return listSeriesReassignTargets(checkpoints, current).some(
    (target) => target.isSuggestedMatch
  );
}

export function getDefaultSeriesReassignTargetId(
  targets: SeriesReassignTarget[]
): string | null {
  return (
    targets.find((target) => target.isSuggestedMatch)?.seriesId ??
    targets[0]?.seriesId ??
    null
  );
}

/** User-facing guidance for the merge/reassign flow. */
export function getMergeSeriesGuidance(
  targets: SeriesReassignTarget[]
): string {
  const suggested = targets.filter((target) => target.isSuggestedMatch);
  if (suggested.length === 1) {
    return `This capture looks like the same area as "${suggested[0].label}". Move this one into that group — you only need to merge once, not both captures.`;
  }
  if (suggested.length > 1) {
    return `This capture matches ${suggested.length} groups at the same location. Move it into the group you want to keep — only one capture needs to move.`;
  }
  if (targets.length > 0) {
    return "Move this capture into another monitoring point. You only need to do this once.";
  }
  return "Create a monitoring point name for this capture, or add more checkpoints first.";
}

export function formatSeriesReassignTargetDescription(
  target: SeriesReassignTarget
): string {
  const countLabel = `${target.captureCount} capture${
    target.captureCount === 1 ? "" : "s"
  }`;
  const latestLabel = target.latestCaptureLabel
    ? ` · latest: ${target.latestCaptureLabel}`
    : "";
  const suggestedLabel = target.isSuggestedMatch ? " · same location" : "";
  return `${countLabel}${latestLabel}${suggestedLabel}`;
}
