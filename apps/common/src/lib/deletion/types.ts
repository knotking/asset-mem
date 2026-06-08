export type DeletionFailure = {
  resource: string;
  message: string;
};

export type DeletionResult = {
  ok: boolean;
  deleted: string[];
  warnings: string[];
  failed: DeletionFailure[];
};

export function emptyDeletionResult(): DeletionResult {
  return { ok: true, deleted: [], warnings: [], failed: [] };
}

export function mergeDeletionResults(...results: DeletionResult[]): DeletionResult {
  const merged = emptyDeletionResult();
  for (const r of results) {
    merged.deleted.push(...r.deleted);
    merged.warnings.push(...r.warnings);
    merged.failed.push(...r.failed);
    if (!r.ok) merged.ok = false;
  }
  return merged;
}

export type DeletionJobStatus = 'running' | 'completed' | 'failed';

export type DeletionJobResponse = {
  jobId: string;
  status: DeletionJobStatus;
  phase?: string;
  warnings?: string[];
  error?: string;
};

export type PropertyDeletionTombstone = {
  deletionStatus?: 'deleting' | 'failed';
  deletionJobId?: string;
  deletionRequestedAt?: unknown;
  deletionError?: string;
};
