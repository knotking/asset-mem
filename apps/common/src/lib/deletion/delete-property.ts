import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { GetFirebaseIdToken } from '../correlation-id';
import {
  getDeletionJobStatus,
  retryDeletionJob,
  startPropertyDeletionJob,
} from './api-client';
import { emptyDeletionResult, type DeletionJobResponse, type DeletionResult } from './types';

export type StartPropertyDeletionParams = {
  db: Firestore;
  userId: string;
  propertyId: string;
  propertyDeleteUrl: string;
  getIdToken: GetFirebaseIdToken;
};

export type PollPropertyDeletionParams = {
  jobStatusUrl: string;
  getIdToken: GetFirebaseIdToken;
  jobId: string;
  intervalMs?: number;
  timeoutMs?: number;
};

/** Tombstone property and start server-side deletion job (disconnect-safe). */
export async function startPropertyDeletion(
  params: StartPropertyDeletionParams
): Promise<{ jobId?: string; result: DeletionResult }> {
  const result = emptyDeletionResult();
  const propertyRef = doc(
    params.db,
    'users',
    params.userId,
    'properties',
    params.propertyId
  );

  const jobStart = await startPropertyDeletionJob({
    url: params.propertyDeleteUrl,
    getIdToken: params.getIdToken,
    userId: params.userId,
    propertyId: params.propertyId,
  });

  if (!jobStart.jobId) {
    result.ok = false;
    result.failed.push({
      resource: `property:${params.propertyId}`,
      message: jobStart.error ?? 'Failed to start deletion job',
    });
    try {
      await updateDoc(propertyRef, {
        deletionStatus: 'failed',
        deletionError: jobStart.error ?? 'Failed to start deletion job',
      });
    } catch {
      // ignore
    }
    return { result };
  }

  try {
    await updateDoc(propertyRef, {
      deletionStatus: 'deleting',
      deletionJobId: jobStart.jobId,
      deletionRequestedAt: serverTimestamp(),
      deletionError: null,
    });
    result.deleted.push(`property-tombstone:${params.propertyId}`);
    result.deleted.push(`deletion-job:${jobStart.jobId}`);
  } catch (err) {
    result.ok = false;
    result.failed.push({
      resource: `property-tombstone:${params.propertyId}`,
      message: err instanceof Error ? err.message : 'tombstone write failed',
    });
    return { jobId: jobStart.jobId, result };
  }

  return { jobId: jobStart.jobId, result };
}

/** Retry a failed or stale property deletion job when jobId is known. */
export async function retryPropertyDeletionJob(params: {
  jobRetryUrl: string;
  getIdToken: GetFirebaseIdToken;
  jobId: string;
  db: Firestore;
  userId: string;
  propertyId: string;
}): Promise<{ jobId?: string; result: DeletionResult }> {
  const result = emptyDeletionResult();
  const propertyRef = doc(
    params.db,
    'users',
    params.userId,
    'properties',
    params.propertyId
  );

  const retry = await retryDeletionJob({
    url: params.jobRetryUrl,
    getIdToken: params.getIdToken,
    jobId: params.jobId,
  });

  if (!retry.job?.jobId) {
    result.ok = false;
    result.failed.push({
      resource: `deletion-job:${params.jobId}`,
      message: retry.error ?? 'Failed to retry deletion job',
    });
    try {
      await updateDoc(propertyRef, {
        deletionStatus: 'failed',
        deletionError: retry.error ?? 'Failed to retry deletion job',
      });
    } catch {
      // ignore
    }
    return { result };
  }

  try {
    await updateDoc(propertyRef, {
      deletionStatus: 'deleting',
      deletionJobId: retry.job.jobId,
      deletionRequestedAt: serverTimestamp(),
      deletionError: null,
    });
    result.deleted.push(`property-tombstone:${params.propertyId}`);
    result.deleted.push(`deletion-job-retry:${retry.job.jobId}`);
  } catch (err) {
    result.ok = false;
    result.failed.push({
      resource: `property-tombstone:${params.propertyId}`,
      message: err instanceof Error ? err.message : 'tombstone write failed',
    });
    return { jobId: retry.job.jobId, result };
  }

  return { jobId: retry.job.jobId, result };
}

/** Poll deletion job until completed, failed, stale, or timeout. */
export async function pollPropertyDeletionJob(
  params: PollPropertyDeletionParams
): Promise<DeletionJobResponse | null> {
  const intervalMs = params.intervalMs ?? 2000;
  const timeoutMs = params.timeoutMs ?? 120_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await getDeletionJobStatus({
      url: params.jobStatusUrl,
      getIdToken: params.getIdToken,
      jobId: params.jobId,
    });
    if (!status) {
      await sleep(intervalMs);
      continue;
    }
    if (
      status.status === 'completed' ||
      status.status === 'failed' ||
      status.status === 'stale'
    ) {
      return status;
    }
    await sleep(intervalMs);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
