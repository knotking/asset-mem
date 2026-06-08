/**
 * Mirrored from @homeapp/common — webapp cannot import common (App Hosting).
 * Keep in sync with apps/common/src/hooks/use-optimistic-deletion-overlay.ts
 */
import { useCallback, useState } from 'react';
import {
  isResourceDeletingOverlay,
  type ResourceDeletionTombstone,
} from '@/lib/deletion/resource-deletion-status';

type DeletingItem = Pick<ResourceDeletionTombstone, 'deletionStatus'> & { id?: string };

/** Local IDs marked deleting on confirm until proxy tombstone or request finishes. */
export function useOptimisticDeletionOverlay() {
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(() => new Set());

  const markDeleting = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setOptimisticIds((prev) => new Set([...prev, ...ids]));
  }, []);

  const clearDeleting = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setOptimisticIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const isDeletingOverlay = useCallback(
    (item: DeletingItem | null | undefined) => isResourceDeletingOverlay(item, optimisticIds),
    [optimisticIds]
  );

  return { markDeleting, clearDeleting, isDeletingOverlay, optimisticIds };
}
