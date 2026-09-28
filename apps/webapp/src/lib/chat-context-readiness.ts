/**
 * Mirrored from @asset-mem/common — webapp cannot import common (App Hosting).
 */
import type { Checkpoint, Document } from "@/lib/types";

export function isCheckpointReady(checkpoint: Checkpoint | undefined | null): boolean {
  return checkpoint?.analysisStatus === "completed";
}

/** Extract-doc worker finished, or legacy doc with no status field. */
export function isDocumentExtractReady(
  status: Document["status"] | null | undefined
): boolean {
  if (status == null) return true;
  return status === "complete";
}

export function isDocumentReady(doc: Document | undefined | null): boolean {
  if (!doc) return false;
  if (doc.status === "uploading" || doc.status === "analyzing" || doc.status === "failed") {
    return false;
  }
  if (!isDocumentExtractReady(doc.status)) {
    return false;
  }
  // New uploads set ragIndexed false while RAG runs; legacy docs omit the field.
  return doc.ragIndexed !== false;
}

export function getCheckpointThumbnail(checkpoint: Checkpoint): string | undefined {
  const media = checkpoint.media?.[0];
  return media?.thumbnailUrl || media?.url;
}

export function isDocumentImage(doc: Document): boolean {
  return !!doc.contentType?.startsWith("image/");
}
