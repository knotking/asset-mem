"use client";

import Image from "next/image";
import { X, FileText, Clock, Loader2, ChevronDown, Plus } from "lucide-react";
import type {
  AnalysisOptionalAgent,
  Checkpoint,
  CheckpointOptionalAgent,
  Document,
  PendingContextItem,
  PrimaryAgent,
  PropertyReport,
} from "@/lib/types";
import {
  getCheckpointThumbnail,
  isDocumentImage,
} from "@/lib/chat-context-readiness";
import {
  ASK_WHEN_READY_HINT,
  ASK_WHEN_READY_LABEL,
} from "@/lib/chat-context-labels";
import { APP_CAPTION_CLASS } from "@/lib/app-typography";
import { buildCollapsedComposerSummary } from "@/lib/composer-collapse";
import { getRequiredContextEmptyPillLabel } from "@/lib/chat-send-context";
import { cn } from "@/lib/utils";

const MOBILE_PEEK_THUMB_COUNT = 3;

type Props = {
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
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
  /** Summary pill — open add-context sheet to review selection. */
  onViewAll?: () => void;
};

type PreviewChip =
  | { kind: "checkpoint"; item: Checkpoint }
  | { kind: "document"; item: Document }
  | { kind: "report"; item: PropertyReport };

type PeekEntry =
  | { key: string; kind: "pending"; item: PendingContextItem }
  | { key: string; kind: "ready"; chip: PreviewChip };

function PeekThumbnail({
  entry,
  className,
}: {
  entry: PeekEntry;
  className?: string;
}) {
  if (entry.kind === "pending") {
    const item = entry.item;
    return (
      <div
        className={cn(
          "relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted",
          className,
        )}
      >
        {item.localPreviewUri ? (
          <Image
            src={item.localPreviewUri}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            {item.kind === "checkpoint" ? (
              <Clock className="h-3 w-3 text-muted-foreground" />
            ) : (
              <FileText className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <Loader2 className="h-3 w-3 animate-spin text-foreground" />
        </div>
      </div>
    );
  }

  const chip = entry.chip;
  if (chip.kind === "checkpoint") {
    const thumb = getCheckpointThumbnail(chip.item);
    return (
      <div
        className={cn(
          "relative h-7 w-7 overflow-hidden rounded-full border-2 border-background bg-primary/10",
          className,
        )}
      >
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <Clock className="h-3 w-3 text-primary" />
          </div>
        )}
      </div>
    );
  }

  if (chip.kind === "document") {
    const doc = chip.item;
    return (
      <div
        className={cn(
          "relative h-7 w-7 overflow-hidden rounded-full border-2 border-background bg-primary/10",
          className,
        )}
      >
        {isDocumentImage(doc) && doc.url ? (
          <Image
            src={doc.url}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <FileText className="h-3 w-3 text-primary" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary/10",
        className,
      )}
    >
      <FileText className="h-3 w-3 text-primary" />
    </div>
  );
}

function ContextSummaryPill({
  peekEntries,
  summary,
  onViewAll,
  variant = "default",
}: {
  peekEntries: PeekEntry[];
  summary: string;
  onViewAll?: () => void;
  variant?: "default" | "empty";
}) {
  const isEmpty = variant === "empty";

  return (
    <button
      type="button"
      onClick={onViewAll}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-2.5",
        "w-full text-left transition-colors hover:bg-muted/50 md:w-auto md:max-w-md",
        isEmpty ? "border-dashed border-muted-foreground/40" : "border-border",
      )}
      aria-label={
        isEmpty ? `${summary}. Add attachment.` : `${summary}. View all attachments.`
      }
    >
      {isEmpty ? (
        <div className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </div>
      ) : peekEntries.length > 0 ? (
        <div className="flex shrink-0 items-center pl-0.5">
          {peekEntries.map((entry, index) => (
            <PeekThumbnail
              key={entry.key}
              entry={entry}
              className={index > 0 ? "-ml-2" : undefined}
            />
          ))}
        </div>
      ) : null}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs font-medium md:flex-none md:max-w-[14rem]",
          isEmpty ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {summary}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

export function ChatContextChipStrip({
  primaryAgent,
  selectedOptionalAgents,
  selectedCheckpointOptionalAgents,
  pendingContext,
  readySelectedCheckpoints,
  readySelectedDocuments,
  readySelectedReports = [],
  queuedSend,
  onCancelQueuedSend,
  onViewAll,
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

  const peekEntries: PeekEntry[] = [];
  for (const item of pendingContext) {
    if (peekEntries.length >= MOBILE_PEEK_THUMB_COUNT) break;
    peekEntries.push({ key: `pending-${item.id}`, kind: "pending", item });
  }
  for (const chip of readyPreview) {
    if (peekEntries.length >= MOBILE_PEEK_THUMB_COUNT) break;
    const key =
      chip.kind === "checkpoint"
        ? `cp-${chip.item.id}`
        : chip.kind === "document"
          ? `doc-${chip.item.id}`
          : `report-${chip.item.id}`;
    peekEntries.push({ key, kind: "ready", chip });
  }

  const contextSummary = buildCollapsedComposerSummary({
    primaryAgent,
    selectedOptionalAgents,
    selectedCheckpointOptionalAgents,
    readyContextCount: readyPreview.length,
    pendingContextCount: pendingContext.length,
    hasQueuedSend: queuedSend != null,
  });

  const hasAttachmentRow =
    pendingContext.length > 0 || readyPreview.length > 0;

  const hasContent = hasAttachmentRow || queuedSend;

  const emptyPillLabel = getRequiredContextEmptyPillLabel({
    primaryAgent,
    readySelectedCheckpoints,
    readySelectedDocuments,
    readySelectedReports,
    pendingContext,
  });

  if (!hasContent) {
    if (emptyPillLabel) {
      return (
        <div className="min-w-0 max-w-full">
          <ContextSummaryPill
            peekEntries={[]}
            summary={emptyPillLabel}
            onViewAll={onViewAll}
            variant="empty"
          />
        </div>
      );
    }
    return null;
  }

  const queuedSendBanner = queuedSend ? (
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
  ) : null;

  return (
    <div className="min-w-0 max-w-full space-y-1.5">
      {queuedSendBanner}
      {hasAttachmentRow ? (
        <ContextSummaryPill
          peekEntries={peekEntries}
          summary={contextSummary}
          onViewAll={onViewAll}
        />
      ) : null}
    </div>
  );
}
