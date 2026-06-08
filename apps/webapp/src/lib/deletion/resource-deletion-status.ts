/** Firestore tombstone fields written by the proxy during leaf deletes. */
export type ResourceDeletionTombstone = {
  deletionStatus?: 'deleting' | 'failed';
  deletionBatchId?: string;
  deletionStartedAt?: unknown;
  deletionFailedAt?: unknown;
  deletionError?: string;
};

export function isResourceDeleting(
  item: Pick<ResourceDeletionTombstone, 'deletionStatus'> | null | undefined
): boolean {
  return item?.deletionStatus === 'deleting';
}

export function isResourceDeletionFailed(
  item: Pick<ResourceDeletionTombstone, 'deletionStatus'> | null | undefined
): boolean {
  return item?.deletionStatus === 'failed';
}

/** True when Firestore tombstone or optimistic local mark says the row is deleting. */
export function isResourceDeletingOverlay(
  item: (Pick<ResourceDeletionTombstone, 'deletionStatus'> & { id?: string }) | null | undefined,
  optimisticIds?: ReadonlySet<string>
): boolean {
  if (isResourceDeleting(item)) return true;
  const id = item?.id;
  return Boolean(id && optimisticIds?.has(id));
}
