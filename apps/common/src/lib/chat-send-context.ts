import type {
  Checkpoint,
  Document,
  MessageContextRefs,
  PendingContextItem,
  PrimaryAgent,
  PropertyReport,
} from "../types";
import { isCheckpointReady, isDocumentReady } from "./chat-context-readiness";
import { capSelectedCheckpoints, capSelectedDocuments } from "./chat-context-picker";
import { capSelectedReports, isReportReady } from "./chat-context-reports";
import {
  PENDING_CHECKPOINT_LABEL,
  PENDING_DOCUMENT_ANALYZE_LABEL,
  PENDING_DOCUMENT_INDEX_LABEL,
  PENDING_DOCUMENT_UPLOAD_LABEL,
  CONTEXT_READY_EMPTY_REPORT,
  CONTEXT_REPORT_NOT_READY,
} from "./chat-context-labels";

export type ChatSendContextInput = {
  primaryAgent: PrimaryAgent;
  text: string;
  readySelectedCheckpoints: Checkpoint[];
  readySelectedDocuments: Document[];
  readySelectedReports: PropertyReport[];
  pendingContext: PendingContextItem[];
  selectedPendingIds?: string[];
};

export function buildAgentRequestContext(input: {
  primaryAgent: PrimaryAgent;
  readySelectedCheckpoints: Checkpoint[];
  readySelectedDocuments: Document[];
  readySelectedReports: PropertyReport[];
}): {
  contextDocURIs: string[];
  checkpointIds: string[];
  reportIds: string[];
  reportRevisions: Record<string, number>;
} {
  const checkpoints = capSelectedCheckpoints(input.readySelectedCheckpoints);
  const documents = capSelectedDocuments(input.readySelectedDocuments);
  const reports = capSelectedReports(input.readySelectedReports);

  const contextDocURIs = documents
    .map((d) => d.gsURI)
    .filter((uri): uri is string => !!uri);

  const checkpointIds =
    input.primaryAgent === "checkpoint"
      ? checkpoints.map((cp) => cp.id).filter((id): id is string => !!id)
      : [];

  const reportIds =
    input.primaryAgent === "report"
      ? reports.map((r) => r.id).filter((id): id is string => !!id)
      : [];

  const reportRevisions: Record<string, number> = {};
  if (input.primaryAgent === "report") {
    for (const report of reports) {
      if (report.id) {
        reportRevisions[report.id] = report.revision ?? 1;
      }
    }
  }

  return { contextDocURIs, checkpointIds, reportIds, reportRevisions };
}

export function buildMessageContextRefs(input: {
  readySelectedCheckpoints: Checkpoint[];
  readySelectedDocuments: Document[];
  readySelectedReports: PropertyReport[];
}): MessageContextRefs {
  const checkpoints = capSelectedCheckpoints(input.readySelectedCheckpoints);
  const documents = capSelectedDocuments(input.readySelectedDocuments);
  const reports = capSelectedReports(input.readySelectedReports);

  return {
    checkpoints: checkpoints.map((cp) => ({
      id: cp.id!,
      name: cp.name,
    })),
    documents: documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
    })),
    reports: reports.map((report) => ({
      id: report.id,
      title: report.title,
      revision: report.revision ?? 1,
    })),
  };
}

function pendingItemsToCheck(input: ChatSendContextInput): PendingContextItem[] {
  const selectedIds = input.selectedPendingIds;
  if (selectedIds && selectedIds.length > 0) {
    return input.pendingContext.filter((p) => selectedIds.includes(p.id));
  }
  return input.pendingContext;
}

function pendingBlockReason(items: PendingContextItem[]): string | null {
  if (items.length === 0) return null;
  const first = items[0];
  if (first.kind === "checkpoint") return PENDING_CHECKPOINT_LABEL;
  if (first.status === "uploading") return PENDING_DOCUMENT_UPLOAD_LABEL;
  if (first.status === "analyzing") return PENDING_DOCUMENT_ANALYZE_LABEL;
  return PENDING_DOCUMENT_INDEX_LABEL;
}

export function getSendBlockReason(input: ChatSendContextInput): string | null {
  const trimmed = input.text.trim();
  if (!trimmed) {
    return "Enter a message.";
  }

  const pendingReason = pendingBlockReason(pendingItemsToCheck(input));
  if (pendingReason) return pendingReason;

  if (input.readySelectedCheckpoints.length > 0) {
    const notReadyCp = input.readySelectedCheckpoints.filter((cp) => !isCheckpointReady(cp));
    if (notReadyCp.length > 0) return PENDING_CHECKPOINT_LABEL;
  }

  if (input.readySelectedDocuments.length > 0) {
    const notReadyDoc = input.readySelectedDocuments.filter((d) => !isDocumentReady(d));
    if (notReadyDoc.length > 0) return PENDING_DOCUMENT_INDEX_LABEL;
  }

  if (input.primaryAgent === "report") {
    if (input.readySelectedReports.length === 0) {
      return CONTEXT_READY_EMPTY_REPORT;
    }
    const notReady = input.readySelectedReports.filter((r) => !isReportReady(r));
    if (notReady.length > 0) return CONTEXT_REPORT_NOT_READY;
  }

  return null;
}

export function canSendChatMessage(input: ChatSendContextInput): boolean {
  return getSendBlockReason(input) === null;
}
