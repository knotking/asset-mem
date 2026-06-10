import { deleteDoc, doc, type Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { GetFirebaseIdToken } from '../correlation-id';
import type { Checkpoint } from '../../types';
import { deleteCheckpointViaProxy, deleteCheckpointsBatchViaProxy } from './api-client';
import { deleteStoragePaths, storagePathsFromCheckpoint } from './storage-paths';
import { emptyDeletionResult, mergeDeletionResults, type DeletionResult } from './types';

export type DeleteCheckpointParams = {
  db: Firestore;
  storage: FirebaseStorage;
  userId: string;
  propertyId: string;
  checkpointId: string;
  checkpoint?: Checkpoint | null;
  checkpointDeleteUrl?: string;
  checkpointsBatchUrl?: string;
  getIdToken?: GetFirebaseIdToken;
};

export async function deleteCheckpointWithMedia(
  params: DeleteCheckpointParams
): Promise<DeletionResult> {
  if (params.checkpointDeleteUrl && params.getIdToken) {
    const result = await deleteCheckpointViaProxy({
      url: params.checkpointDeleteUrl,
      getIdToken: params.getIdToken,
      userId: params.userId,
      propertyId: params.propertyId,
      checkpointId: params.checkpointId,
    });
    if (!result.ok) return result;
    return result;
  }

  const paths = params.checkpoint
    ? storagePathsFromCheckpoint(params.checkpoint)
    : [];
  const storageResult = await deleteStoragePaths(params.storage, paths);
  const result = emptyDeletionResult();
  try {
    await deleteDoc(
      doc(
        params.db,
        'users',
        params.userId,
        'properties',
        params.propertyId,
        'checkpoints',
        params.checkpointId
      )
    );
    result.deleted.push(`firestore:checkpoints/${params.checkpointId}`);
  } catch (err) {
    result.ok = false;
    result.failed.push({
      resource: `firestore:checkpoints/${params.checkpointId}`,
      message: err instanceof Error ? err.message : 'Firestore delete failed',
    });
  }
  return mergeDeletionResults(storageResult, result);
}

export async function deleteCheckpointsBatch(params: {
  userId: string;
  propertyId: string;
  checkpointIds: string[];
  checkpointsBatchUrl: string;
  getIdToken: GetFirebaseIdToken;
}): Promise<DeletionResult> {
  return deleteCheckpointsBatchViaProxy({
    url: params.checkpointsBatchUrl,
    getIdToken: params.getIdToken,
    userId: params.userId,
    propertyId: params.propertyId,
    checkpointIds: params.checkpointIds,
  });
}
