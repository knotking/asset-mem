import type { DocumentPickerAsset } from '@homeapp/common/contexts/document-upload-context';

type PendingUpload = {
  propertyId: string;
  files: DocumentPickerAsset[];
};

let pending: PendingUpload | null = null;

/** Stash files for the next property-details screen (avoids oversized/unstable route params). */
export function setPendingPropertyUpload(propertyId: string, files: DocumentPickerAsset[]): void {
  pending = { propertyId, files };
}

/** Read pending files without clearing (for effect dependency checks). */
export function peekPendingPropertyUpload(propertyId: string): DocumentPickerAsset[] | null {
  if (!pending || pending.propertyId !== propertyId) {
    return null;
  }
  return pending.files;
}

/** Drop any queued upload for a property (e.g. plan limit — do not re-alert on later visits). */
export function clearPendingPropertyUpload(propertyId?: string): void {
  if (!propertyId || pending?.propertyId === propertyId) {
    pending = null;
  }
}

/** Returns and clears pending files when upload is about to start. */
export function consumePendingPropertyUpload(propertyId: string): DocumentPickerAsset[] | null {
  if (!pending || pending.propertyId !== propertyId) {
    return null;
  }
  const files = pending.files;
  pending = null;
  return files;
}
