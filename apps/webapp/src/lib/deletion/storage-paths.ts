import { deleteObject, listAll, ref, type FirebaseStorage } from 'firebase/storage';
import type { Checkpoint, CheckpointMedia, Message } from '@/lib/types';
import { emptyDeletionResult, mergeDeletionResults, type DeletionResult } from './types';

export function gsUriToStoragePath(gsURI: string, bucket?: string): string | null {
  if (!gsURI?.startsWith('gs://')) return null;
  const withoutScheme = gsURI.slice('gs://'.length);
  const slash = withoutScheme.indexOf('/');
  if (slash < 0) return null;
  const path = withoutScheme.slice(slash + 1);
  if (bucket && !withoutScheme.startsWith(`${bucket}/`)) {
    const uriBucket = withoutScheme.slice(0, slash);
    if (uriBucket !== bucket) return path;
  }
  return path;
}

export function storagePathFromMessageFile(message: Message): string[] {
  const paths: string[] = [];
  if (message.file?.gsURI) {
    const p = gsUriToStoragePath(message.file.gsURI);
    if (p) paths.push(p);
  }
  return paths;
}

export function storagePathsFromCheckpointMedia(media: CheckpointMedia[] | undefined): string[] {
  if (!media?.length) return [];
  const paths = new Set<string>();
  for (const item of media) {
    if (item.storagePath) paths.add(item.storagePath);
    if (item.gsURI) {
      const p = gsUriToStoragePath(item.gsURI);
      if (p) paths.add(p);
    }
    if (item.thumbnailUrl?.includes('firebasestorage')) {
      // download URLs are not storage paths; skip
    }
  }
  return [...paths];
}

export function storagePathsFromCheckpoint(checkpoint: Checkpoint): string[] {
  return storagePathsFromCheckpointMedia(checkpoint.media);
}

export async function deleteStoragePath(
  storage: FirebaseStorage,
  storagePath: string
): Promise<{ ok: boolean; message?: string }> {
  if (!storagePath?.trim()) return { ok: true };
  try {
    await deleteObject(ref(storage, storagePath));
    return { ok: true };
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code)
        : undefined;
    if (code === 'storage/object-not-found') return { ok: true };
    const message = err instanceof Error ? err.message : 'Storage delete failed';
    return { ok: false, message };
  }
}

export async function deleteStoragePaths(
  storage: FirebaseStorage,
  paths: string[]
): Promise<DeletionResult> {
  const result = emptyDeletionResult();
  const unique = [...new Set(paths.filter(Boolean))];
  for (const path of unique) {
    const outcome = await deleteStoragePath(storage, path);
    if (outcome.ok) {
      result.deleted.push(`storage:${path}`);
    } else {
      result.ok = false;
      result.failed.push({ resource: `storage:${path}`, message: outcome.message ?? 'failed' });
    }
  }
  return result;
}

/** Recursively delete all objects under a Storage prefix (client SDK listAll). */
export async function deleteStoragePrefix(
  storage: FirebaseStorage,
  prefix: string
): Promise<DeletionResult> {
  const result = emptyDeletionResult();
  if (!prefix?.trim()) return result;

  const rootRef = ref(storage, prefix.replace(/\/$/, ''));
  try {
    const listing = await listAll(rootRef);
    const fileDeletes = listing.items.map((item) => deleteStoragePath(storage, item.fullPath));
    const folderDeletes = listing.prefixes.map((sub) => deleteStoragePrefix(storage, sub.fullPath));
    const nested = await Promise.all(folderDeletes);
    const files = await Promise.all(fileDeletes);

    for (const f of files) {
      if (f.ok) result.deleted.push(`storage:${prefix}`);
      else {
        result.ok = false;
        result.failed.push({ resource: prefix, message: f.message ?? 'failed' });
      }
    }
    return mergeDeletionResults(result, ...nested);
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code)
        : undefined;
    if (code === 'storage/object-not-found') return result;
    result.ok = false;
    result.failed.push({
      resource: `storage-prefix:${prefix}`,
      message: err instanceof Error ? err.message : 'prefix delete failed',
    });
    return result;
  }
}
