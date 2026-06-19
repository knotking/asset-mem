"use client";

import Image from "next/image";
import { X, FileText, Clock, Loader2 } from "lucide-react";
import type { Checkpoint, Document, PendingContextItem, PropertyReport } from "@/lib/types";
import { reportContextChipLabel } from "@/lib/chat-context-reports";
import {
  getCheckpointThumbnail,
  isDocumentImage,
} from "@/lib/chat-context-readiness";
import {
  ASK_WHEN_READY_HINT,
  ASK_WHEN_READY_LABEL,
  PENDING_CHECKPOINT_LABEL,
  PENDING_DOCUMENT_ANALYZE_LABEL,
  PENDING_DOCUMENT_INDEX_LABEL,
  PENDING_DOCUMENT_UPLOAD_LABEL,
} from "@/lib/chat-context-labels";
import { ADD_CONTEXT_VISIBLE_CHIP_COUNT } from "@/lib/chat-context-limits";
import { APP_CAPTION_CLASS } from "@/lib/app-typography";

type Props = {
  pendingContext: PendingContextItem[];
  readySelectedCheckpoints: Checkpoint[];
  readySelectedDocuments: Document[];
  readySelectedReports?: PropertyReport[];
  queuedSend: { text: string } | null;
  onToggleCheckpoint: (cp: Checkpoint) => void;
  onToggleDocument: (doc: Document) => void;
  onToggleReport?: (report: PropertyReport) => void;
  onRemovePending: (id: string) => void;
  onClearReady: () => void;
  onCancelQueuedSend?: () => void;
};

function pendingLabel(item: PendingContextItem): string {
  if (item.kind === "checkpoint") return PENDING_CHECKPOINT_LABEL;
  if (item.status === "uploading") return PENDING_DOCUMENT_UPLOAD_LABEL;
  if (item.status === "analyzing") return PENDING_DOCUMENT_ANALYZE_LABEL;
  return PENDING_DOCUMENT_INDEX_LABEL;
}

type PreviewChip =
  | { kind: "checkpoint"; item: Checkpoint }
  | { kind: "document"; item: Document }
  | { kind: "report"; item: PropertyReport };

export function ChatContextChipStrip({
  pendingContext,
  readySelectedCheckpoints,
  readySelectedDocuments,
  readySelectedReports = [],
  queuedSend,
  onToggleCheckpoint,
  onToggleDocument,
  onToggleReport,
  onRemovePending,
  onClearReady,
  onCancelQueuedSend,
}: Props) {
  const readyPreview: PreviewChip[] = [];
  for (const cp of readySelectedCheckpoints) {
    readyPreview.push({ kind: "checkpoint", item: cp });
  }
  for (const doc of readySelectedDocuments) {
    readyPreview.push({ kind: "document", item: doc });
  }
  for (const report of readySelectedReports) {
    readyPreview.push({ kind: "report", item: report });
  }

  const visibleReady = readyPreview.slice(0, ADD_CONTEXT_VISIBLE_CHIP_COUNT);
  const hiddenReadyCount = Math.max(0, readyPreview.length - visibleReady.length);

  const hasContent =
    pendingContext.length > 0 || readyPreview.length > 0 || queuedSend;

  if (!hasContent) return null;

  return (
    <div className="mb-2 min-w-0 max-w-full space-y-2">
      {queuedSend ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <div className="mr-2 min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">{ASK_WHEN_READY_LABEL}</p>
            <p className="truncate text-xs text-muted-foreground">{queuedSend.text}</p>
            <p className={APP_CAPTION_CLASS}>{ASK_WHEN_READY_HINT}</p>
          </div>
          {onCancelQueuedSend ? (
            <button type="button" onClick={onCancelQueuedSend} className="shrink-0 p-1">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain scrollbar-hidden pb-1 pr-0.5">
        {pendingContext.map((item) => (
          <div
            key={item.id}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/50 py-1 pl-1 pr-2"
          >
            {item.localPreviewUri ? (
              <Image
                src={item.localPreviewUri}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-md object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                {item.kind === "checkpoint" ? (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            )}
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="max-w-28 truncate text-xs text-muted-foreground">
              {item.label || pendingLabel(item)}
            </span>
            <button
              type="button"
              onClick={() => onRemovePending(item.id)}
              className="rounded-md p-1.5"
              aria-label={`Remove ${item.label || pendingLabel(item)}`}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}

        {visibleReady.map((chip) => {
          if (chip.kind === "checkpoint") {
            const cp = chip.item;
            const thumb = getCheckpointThumbnail(cp);
            return (
              <button
                key={`cp-${cp.id}`}
                type="button"
                onClick={() => onToggleCheckpoint(cp)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-primary/10 py-1 pl-1 pr-2"
              >
                {thumb ? (
                  <Image
                    src={thumb}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-md object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <span className="max-w-24 truncate text-xs text-foreground">
                  {cp.name || "Checkpoint"}
                </span>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            );
          }
          if (chip.kind === "document") {
            const doc = chip.item;
            return (
              <button
                key={`doc-${doc.id}`}
                type="button"
                onClick={() => onToggleDocument(doc)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-primary/10 py-1 pl-1 pr-2"
              >
                {isDocumentImage(doc) && doc.url ? (
                  <Image
                    src={doc.url}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-md object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <span className="max-w-24 truncate text-xs text-foreground">{doc.name}</span>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            );
          }
          const report = chip.item;
          return (
            <button
              key={`report-${report.id}`}
              type="button"
              onClick={() => onToggleReport?.(report)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-primary/10 py-1 pl-1 pr-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="max-w-28 truncate text-xs text-foreground">
                {reportContextChipLabel(report)}
              </span>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          );
        })}

        {hiddenReadyCount > 0 ? (
          <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-primary/40 bg-primary/5 px-2.5 text-xs font-medium text-primary">
            +{hiddenReadyCount} more
          </span>
        ) : null}

        {readyPreview.length > 0 && (
          <button
            type="button"
            onClick={onClearReady}
            className="inline-flex h-10 shrink-0 items-center rounded-lg bg-secondary px-2 text-xs text-muted-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
