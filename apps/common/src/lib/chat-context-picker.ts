import type { Checkpoint, Document, PrimaryAgent, PropertyReport } from "../types";
import { filterReadyReports, pickDefaultReadyReport } from "./chat-context-reports";
import {
  ADD_CONTEXT_RECENT_READY_COUNT,
  MAX_SELECTED_CHECKPOINTS,
  MAX_SELECTED_DOCUMENTS,
} from "./chat-context-limits";
import { isCheckpointReady, isDocumentReady } from "./chat-context-readiness";

function normalizeSearch(query: string): string {
  return query.trim().toLowerCase();
}

function checkpointSearchText(cp: Checkpoint): string {
  return [cp.name, cp.location, cp.description, cp.assetType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function documentSearchText(doc: Document): string {
  return [doc.name, doc.documentType, doc.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortByCreatedDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aMs = toMillis(a.createdAt);
    const bMs = toMillis(b.createdAt);
    return bMs - aMs;
  });
}

function toMillis(createdAt: unknown): number {
  if (!createdAt) return 0;
  if (typeof createdAt === "object" && createdAt !== null && "toMillis" in createdAt) {
    return (createdAt as { toMillis: () => number }).toMillis();
  }
  if (createdAt instanceof Date) return createdAt.getTime();
  return 0;
}

export function filterReadyCheckpoints(checkpoints: Checkpoint[]): Checkpoint[] {
  return sortByCreatedDesc(checkpoints.filter(isCheckpointReady));
}

export function filterReadyDocuments(documents: Document[]): Document[] {
  return sortByCreatedDesc(
    documents.filter(
      (doc) => isDocumentReady(doc) && doc.documentType !== "PROPERTY_REPORT"
    )
  );
}

export function filterCheckpointsBySearch(
  checkpoints: Checkpoint[],
  query: string
): Checkpoint[] {
  const q = normalizeSearch(query);
  const ready = filterReadyCheckpoints(checkpoints);
  if (!q) return ready;
  return ready.filter((cp) => checkpointSearchText(cp).includes(q));
}

export function filterDocumentsBySearch(
  documents: Document[],
  query: string
): Document[] {
  const q = normalizeSearch(query);
  const ready = filterReadyDocuments(documents);
  if (!q) return ready;
  return ready.filter((doc) => documentSearchText(doc).includes(q));
}

export function getRecentReadyCheckpoints(
  checkpoints: Checkpoint[],
  limit = ADD_CONTEXT_RECENT_READY_COUNT
): Checkpoint[] {
  return filterReadyCheckpoints(checkpoints).slice(0, limit);
}

export function getRecentReadyDocuments(
  documents: Document[],
  limit = ADD_CONTEXT_RECENT_READY_COUNT
): Document[] {
  return filterReadyDocuments(documents).slice(0, limit);
}

/** Most recent ready checkpoint for default composer context (skipped in Docs mode). */
export function pickDefaultReadyCheckpoint(
  checkpoints: Checkpoint[],
  primaryAgent: PrimaryAgent
): Checkpoint | undefined {
  if (primaryAgent === "docs" || primaryAgent === "report") return undefined;
  return getRecentReadyCheckpoints(checkpoints, 1)[0];
}

/** Most recent ready document for default composer context. */
export function pickDefaultReadyDocument(
  documents: Document[],
  primaryAgent: PrimaryAgent
): Document | undefined {
  if (primaryAgent === "report") return undefined;
  return getRecentReadyDocuments(documents, 1)[0];
}

export function pickDefaultReadyReportForAgent(
  reports: PropertyReport[],
  primaryAgent: PrimaryAgent
): PropertyReport | undefined {
  if (primaryAgent !== "report") return undefined;
  return pickDefaultReadyReport(reports);
}

export { filterReadyReports, filterReportsBySearch } from "./chat-context-reports";

export function canSelectMoreCheckpoints(selectedCount: number): boolean {
  return selectedCount < MAX_SELECTED_CHECKPOINTS;
}

export function canSelectMoreDocuments(selectedCount: number): boolean {
  return selectedCount < MAX_SELECTED_DOCUMENTS;
}

export function capSelectedCheckpoints(checkpoints: Checkpoint[]): Checkpoint[] {
  return checkpoints.slice(0, MAX_SELECTED_CHECKPOINTS);
}

export function capSelectedDocuments(documents: Document[]): Document[] {
  return documents.slice(0, MAX_SELECTED_DOCUMENTS);
}
