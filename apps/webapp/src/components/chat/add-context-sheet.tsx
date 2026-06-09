"use client";

import * as React from "react";
import Image from "next/image";
import {
  X,
  Camera,
  Images,
  Video,
  FileText,
  Clock,
  Upload,
  Search,
  Loader2,
} from "lucide-react";
import type {
  Checkpoint,
  Document,
  PendingContextItem,
  PrimaryAgent,
  PropertyReport,
} from "@/lib/types";
import type { ToggleSelectionResult } from "@/contexts/chat-context-context";
import {
  reportSelectionKey,
  toRevisionSelectionReport,
} from "@/lib/report-revisions";
import { buildCurrentRevisionReportPickerRows } from "@/lib/report-picker-rows";
import {
  getCheckpointThumbnail,
  isCheckpointReady,
  isDocumentReady,
  isDocumentImage,
} from "@/lib/chat-context-readiness";
import {
  ADD_CONTEXT_TITLE,
  ADD_CONTEXT_RECENT_LABEL,
  getAddContextLibrarySectionLabel,
  shouldShowAddContextLibrarySectionHeader,
  ADD_CONTEXT_SELECTED_SUMMARY,
  ADD_CONTEXT_TAB_DOCUMENTS,
  ADD_CONTEXT_TAB_TIMELINE,
  ADD_CONTEXT_MODE_HINT_CHECKPOINT,
  ADD_CONTEXT_MODE_HINT_DOCS,
  ADD_CONTEXT_MODE_HINT_REPORT,
  CONTEXT_SELECTION_REPORT_LIMIT,
  ADD_CONTEXT_SEARCH_PLACEHOLDER_TIMELINE,
  ADD_CONTEXT_SEARCH_PLACEHOLDER_DOCUMENTS,
  PENDING_CHECKPOINT_LABEL,
  PENDING_DOCUMENT_ANALYZE_LABEL,
  PENDING_DOCUMENT_INDEX_LABEL,
  PENDING_DOCUMENT_UPLOAD_LABEL,
  CONTEXT_SELECTION_CHECKPOINT_LIMIT,
  CONTEXT_SELECTION_DOCUMENT_LIMIT,
  type AddContextCaptureAction,
} from "@/lib/chat-context-labels";
import {
  ADD_CONTEXT_DOC_BROWSE_PAGE_SIZE,
  MAX_SELECTED_CHECKPOINTS,
  MAX_SELECTED_DOCUMENTS,
} from "@/lib/chat-context-limits";
import {
  filterCheckpointsBySearch,
  filterDocumentsBySearch,
  filterReportsBySearch,
  getRecentReadyCheckpoints,
  getRecentReadyDocuments,
} from "@/lib/chat-context-picker";
import { MAX_SELECTED_REPORTS } from "@/lib/chat-context-reports";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ContextTab = "timeline" | "documents";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryAgent: PrimaryAgent;
  checkpoints: Checkpoint[];
  documents: Document[];
  pendingContext: PendingContextItem[];
  selectedCheckpointIds: Set<string>;
  selectedDocumentIds: Set<string>;
  selectedCheckpointCount: number;
  selectedDocumentCount: number;
  onToggleCheckpoint: (cp: Checkpoint) => ToggleSelectionResult;
  onToggleDocument: (doc: Document) => ToggleSelectionResult;
  onClearSelection: () => void;
  onCapturePhoto: () => Promise<boolean> | boolean;
  onCaptureVideo: () => Promise<boolean> | boolean;
  onPickGallery: () => Promise<boolean> | boolean;
  onUploadDocument: () => Promise<boolean> | boolean;
  hasMoreCheckpoints: boolean;
  isLoadingMoreCheckpoints: boolean;
  onLoadMoreCheckpoints: () => void;
  reports?: PropertyReport[];
  selectedReportIds?: Set<string>;
  selectedReportCount?: number;
  onToggleReport?: (report: PropertyReport) => ToggleSelectionResult;
};

function ContextListRow({
  thumbnailUri,
  fallbackIcon: FallbackIcon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  thumbnailUri?: string;
  fallbackIcon: typeof Clock;
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left",
        selected ? "border-primary bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {thumbnailUri ? (
          <Image
            src={thumbnailUri}
            alt=""
            width={56}
            height={56}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FallbackIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "h-5 w-5 shrink-0 rounded-full border-2",
          selected ? "border-primary bg-primary" : "border-muted-foreground"
        )}
      />
    </button>
  );
}

function pendingItemLabel(item: PendingContextItem): string {
  if (item.kind === "checkpoint") return PENDING_CHECKPOINT_LABEL;
  if (item.status === "uploading") return PENDING_DOCUMENT_UPLOAD_LABEL;
  if (item.status === "analyzing") return PENDING_DOCUMENT_ANALYZE_LABEL;
  return PENDING_DOCUMENT_INDEX_LABEL;
}

function PendingContextRow({ item }: { item: PendingContextItem }) {
  const FallbackIcon = item.kind === "checkpoint" ? Clock : FileText;
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/50 p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.localPreviewUri ? (
          <Image
            src={item.localPreviewUri}
            alt=""
            width={56}
            height={56}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FallbackIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {item.label || (item.kind === "checkpoint" ? "Checkpoint" : "Document")}
        </p>
        <p className="truncate text-xs text-muted-foreground">{pendingItemLabel(item)}</p>
      </div>
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
    </div>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

export function AddContextSheet({
  open,
  onOpenChange,
  primaryAgent,
  checkpoints,
  documents,
  pendingContext,
  selectedCheckpointIds,
  selectedDocumentIds,
  selectedCheckpointCount,
  selectedDocumentCount,
  onToggleCheckpoint,
  onToggleDocument,
  onClearSelection,
  onCapturePhoto,
  onCaptureVideo,
  onPickGallery,
  onUploadDocument,
  hasMoreCheckpoints,
  isLoadingMoreCheckpoints,
  onLoadMoreCheckpoints,
  reports = [],
  selectedReportIds = new Set<string>(),
  selectedReportCount = 0,
  onToggleReport,
}: Props) {
  const isReportMode = primaryAgent === "report";
  const isDocsMode = primaryAgent === "docs";
  const defaultTab: ContextTab = primaryAgent === "checkpoint" ? "timeline" : "documents";
  const [activeTab, setActiveTab] = React.useState<ContextTab>(defaultTab);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [docVisibleCount, setDocVisibleCount] = React.useState(
    ADD_CONTEXT_DOC_BROWSE_PAGE_SIZE
  );
  const [limitHint, setLimitHint] = React.useState<string | null>(null);
  const [launchingAction, setLaunchingAction] = React.useState<AddContextCaptureAction | null>(
    null
  );
  const launchingRef = React.useRef(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const closeAfterAction = React.useCallback(
    (actionKind: AddContextCaptureAction, action: () => Promise<boolean> | boolean) => {
      if (launchingRef.current) return;
      launchingRef.current = true;
      setLaunchingAction(actionKind);
      void (async () => {
        try {
          const shouldClose = await action();
          if (shouldClose) onOpenChange(false);
        } finally {
          launchingRef.current = false;
          setLaunchingAction(null);
        }
      })();
    },
    [onOpenChange]
  );

  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDocVisibleCount(ADD_CONTEXT_DOC_BROWSE_PAGE_SIZE);
      setLimitHint(null);
      launchingRef.current = false;
      setLaunchingAction(null);
    } else {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  const pendingCheckpointCount = pendingContext.filter((p) => p.kind === "checkpoint").length;
  const pendingDocumentCount = pendingContext.filter((p) => p.kind === "document").length;
  const hasPendingContext = pendingContext.length > 0;
  const pendingCheckpoints = pendingContext.filter((p) => p.kind === "checkpoint");
  const pendingDocuments = pendingContext.filter((p) => p.kind === "document");
  const pendingSummaryParts: string[] = [];
  if (pendingCheckpointCount > 0) {
    pendingSummaryParts.push(
      `${pendingCheckpointCount} checkpoint${pendingCheckpointCount === 1 ? "" : "s"}`
    );
  }
  if (pendingDocumentCount > 0) {
    pendingSummaryParts.push(
      `${pendingDocumentCount} document${pendingDocumentCount === 1 ? "" : "s"}`
    );
  }

  const isCheckpointMode = primaryAgent === "checkpoint";
  const trimmedSearch = searchQuery.trim();
  const hasSearch = trimmedSearch.length > 0;

  const reportPickerRows = React.useMemo(
    () =>
      isReportMode
        ? buildCurrentRevisionReportPickerRows(filterReportsBySearch(reports, trimmedSearch))
        : [],
    [isReportMode, reports, trimmedSearch]
  );

  const recentCheckpoints = React.useMemo(
    () => (hasSearch ? [] : getRecentReadyCheckpoints(checkpoints)),
    [checkpoints, hasSearch]
  );
  const recentDocuments = React.useMemo(
    () => (hasSearch ? [] : getRecentReadyDocuments(documents)),
    [documents, hasSearch]
  );

  const browseCheckpoints = React.useMemo(() => {
    const filtered = filterCheckpointsBySearch(checkpoints, trimmedSearch);
    if (!hasSearch) {
      const recentIds = new Set(recentCheckpoints.map((c) => c.id));
      return filtered.filter((c) => !recentIds.has(c.id));
    }
    return filtered;
  }, [checkpoints, trimmedSearch, hasSearch, recentCheckpoints]);

  const browseDocuments = React.useMemo(() => {
    const filtered = filterDocumentsBySearch(documents, trimmedSearch);
    if (!hasSearch) {
      const recentIds = new Set(recentDocuments.map((d) => d.id));
      return filtered.filter((d) => !recentIds.has(d.id));
    }
    return filtered;
  }, [documents, trimmedSearch, hasSearch, recentDocuments]);

  const visibleBrowseDocuments = browseDocuments.slice(0, docVisibleCount);
  const hasMoreDocs = browseDocuments.length > docVisibleCount;

  const handleToggleCheckpoint = (cp: Checkpoint) => {
    if (!isCheckpointReady(cp)) return;
    const result = onToggleCheckpoint(cp);
    setLimitHint(
      result === "limit_reached"
        ? CONTEXT_SELECTION_CHECKPOINT_LIMIT(MAX_SELECTED_CHECKPOINTS)
        : null
    );
  };

  const handleToggleDocument = (doc: Document) => {
    if (!isDocumentReady(doc)) return;
    const result = onToggleDocument(doc);
    setLimitHint(
      result === "limit_reached"
        ? CONTEXT_SELECTION_DOCUMENT_LIMIT(MAX_SELECTED_DOCUMENTS)
        : null
    );
  };

  const captureBusy = launchingAction !== null;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (
      !el ||
      activeTab !== "timeline" ||
      !isCheckpointMode ||
      !hasMoreCheckpoints ||
      isLoadingMoreCheckpoints
    ) {
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) onLoadMoreCheckpoints();
  };

  const handleToggleReport = (report: PropertyReport) => {
    if (!onToggleReport) return;
    const result = onToggleReport(report);
    setLimitHint(
      result === "limit_reached"
        ? CONTEXT_SELECTION_REPORT_LIMIT(MAX_SELECTED_REPORTS)
        : null
    );
  };

  const modeHint = isReportMode
    ? ADD_CONTEXT_MODE_HINT_REPORT
    : isCheckpointMode
      ? ADD_CONTEXT_MODE_HINT_CHECKPOINT
      : ADD_CONTEXT_MODE_HINT_DOCS;

  const searchPlaceholder =
    activeTab === "timeline"
      ? ADD_CONTEXT_SEARCH_PLACEHOLDER_TIMELINE
      : ADD_CONTEXT_SEARCH_PLACEHOLDER_DOCUMENTS;

  const renderTimelineList = () => {
    return (
      <>
        {pendingCheckpoints.length > 0 ? (
          <>
            <p className="mb-2 mt-4 text-sm font-semibold">Pending</p>
            {pendingCheckpoints.map((pending) => (
              <PendingContextRow key={`pending-cp-${pending.id}`} item={pending} />
            ))}
          </>
        ) : null}
        {recentCheckpoints.length > 0 && !hasSearch ? (
          <>
            <p className="mb-2 mt-4 text-sm font-semibold">{ADD_CONTEXT_RECENT_LABEL}</p>
            {recentCheckpoints.map((cp) => (
              <ContextListRow
                key={`recent-${cp.id}`}
                thumbnailUri={getCheckpointThumbnail(cp)}
                fallbackIcon={Clock}
                title={cp.name || "Checkpoint"}
                subtitle={cp.location}
                selected={selectedCheckpointIds.has(cp.id!)}
                onPress={() => handleToggleCheckpoint(cp)}
              />
            ))}
          </>
        ) : null}
        {shouldShowAddContextLibrarySectionHeader(
          hasSearch,
          recentCheckpoints.length > 0 && !hasSearch
        ) ? (
          <p className="mb-2 mt-3 text-sm font-semibold">
            {getAddContextLibrarySectionLabel("timeline", hasSearch)}
          </p>
        ) : null}
        {browseCheckpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasSearch
              ? "No matching checkpoints."
              : recentCheckpoints.length > 0
                ? "No checkpoints beyond Recent."
                : "No checkpoints available yet. Capture one above."}
          </p>
        ) : (
          browseCheckpoints.map((cp) => (
            <ContextListRow
              key={cp.id}
              thumbnailUri={getCheckpointThumbnail(cp)}
              fallbackIcon={Clock}
              title={cp.name || "Checkpoint"}
              subtitle={cp.location}
              selected={selectedCheckpointIds.has(cp.id!)}
              onPress={() => handleToggleCheckpoint(cp)}
            />
          ))
        )}
        {hasMoreCheckpoints ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            onClick={onLoadMoreCheckpoints}
            disabled={isLoadingMoreCheckpoints}
          >
            {isLoadingMoreCheckpoints ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more checkpoints"
            )}
          </Button>
        ) : null}
      </>
    );
  };

  const renderDocumentsList = () => (
    <>
      {pendingDocuments.length > 0 ? (
        <>
          <p className="mb-2 mt-4 text-sm font-semibold">Pending</p>
          {pendingDocuments.map((pending) => (
            <PendingContextRow key={`pending-doc-${pending.id}`} item={pending} />
          ))}
        </>
      ) : null}
      {recentDocuments.length > 0 && !hasSearch ? (
        <>
          <p className="mb-2 mt-4 text-sm font-semibold">{ADD_CONTEXT_RECENT_LABEL}</p>
          {recentDocuments.map((doc) => (
            <ContextListRow
              key={`recent-${doc.id}`}
              thumbnailUri={isDocumentImage(doc) ? doc.url : undefined}
              fallbackIcon={FileText}
              title={doc.name}
              subtitle={doc.documentType}
              selected={selectedDocumentIds.has(doc.id)}
              onPress={() => handleToggleDocument(doc)}
            />
          ))}
        </>
      ) : null}
      {shouldShowAddContextLibrarySectionHeader(
        hasSearch,
        recentDocuments.length > 0 && !hasSearch
      ) ? (
        <p className="mb-2 mt-3 text-sm font-semibold">
          {getAddContextLibrarySectionLabel("documents", hasSearch)}
        </p>
      ) : null}
      {visibleBrowseDocuments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasSearch
            ? "No matching documents."
            : recentDocuments.length > 0
              ? "No documents beyond Recent."
              : "No documents available yet. Upload one above."}
        </p>
      ) : (
        visibleBrowseDocuments.map((doc) => (
          <ContextListRow
            key={doc.id}
            thumbnailUri={isDocumentImage(doc) ? doc.url : undefined}
            fallbackIcon={FileText}
            title={doc.name}
            subtitle={doc.documentType}
            selected={selectedDocumentIds.has(doc.id)}
            onPress={() => handleToggleDocument(doc)}
          />
        ))
      )}
      {hasMoreDocs ? (
        <Button
          type="button"
          variant="outline"
          className="mt-2 w-full"
          onClick={() =>
            setDocVisibleCount((n) => n + ADD_CONTEXT_DOC_BROWSE_PAGE_SIZE)
          }
        >
          Load more documents
        </Button>
      ) : null}
    </>
  );

  if (isDocsMode) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "flex h-[85vh] max-h-[85vh] flex-col rounded-t-2xl p-0",
            "left-1/2 right-auto w-full max-w-lg -translate-x-1/2",
            "sm:max-w-xl md:max-w-2xl",
            "border-x shadow-2xl"
          )}
        >
          <SheetHeader className="shrink-0 border-b px-4 py-3">
            <SheetTitle>{ADD_CONTEXT_TITLE}</SheetTitle>
          </SheetHeader>
          <div className="shrink-0 space-y-2 border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedDocumentCount} selected ·{" "}
                {CONTEXT_SELECTION_DOCUMENT_LIMIT(MAX_SELECTED_DOCUMENTS)}
              </p>
              {selectedDocumentCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-primary"
                  onClick={onClearSelection}
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs leading-4 text-muted-foreground">{modeHint}</p>
            <Button
              type="button"
              variant="outline"
              disabled={captureBusy}
              className={cn(
                "h-auto w-full gap-2 py-3",
                launchingAction === "upload" && "border-primary bg-primary/10"
              )}
              onClick={() => closeAfterAction("upload", onUploadDocument)}
            >
              {launchingAction === "upload" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              Upload document
            </Button>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ADD_CONTEXT_SEARCH_PLACEHOLDER_DOCUMENTS}
              className="h-9"
            />
            {limitHint ? (
              <p className="text-xs text-destructive">{limitHint}</p>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {hasPendingContext ? (
              <div className="mb-2 mt-4 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Processing {pendingContext.length} item
                  {pendingContext.length === 1 ? "" : "s"}
                  {pendingSummaryParts.length > 0
                    ? ` (${pendingSummaryParts.join(", ")})`
                    : ""}
                  . They will auto-select when ready.
                </p>
              </div>
            ) : null}
            {renderDocumentsList()}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (isReportMode) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "flex h-[85vh] max-h-[85vh] flex-col rounded-t-2xl p-0",
            "left-1/2 right-auto w-full max-w-lg -translate-x-1/2",
            "sm:max-w-xl md:max-w-2xl",
            "border-x shadow-2xl"
          )}
        >
          <SheetHeader className="shrink-0 border-b px-4 py-3">
            <SheetTitle>{ADD_CONTEXT_TITLE}</SheetTitle>
          </SheetHeader>
          <div className="shrink-0 space-y-2 border-b px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {selectedReportCount} selected ·{" "}
              {CONTEXT_SELECTION_REPORT_LIMIT(MAX_SELECTED_REPORTS)}
            </p>
            <p className="text-xs leading-4 text-muted-foreground">{modeHint}</p>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by title…"
              className="h-9"
            />
            {limitHint ? (
              <p className="text-xs text-destructive">{limitHint}</p>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {reportPickerRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No ready reports yet. Generate one from the Reports tab.
              </p>
            ) : (
              reportPickerRows.map((item) => {
                const report = toRevisionSelectionReport(
                  item.parent,
                  item.revision,
                  item.isArchived
                );
                return (
                  <ContextListRow
                    key={reportSelectionKey(item.reportId, item.revision)}
                    fallbackIcon={FileText}
                    title={report.title}
                    subtitle={`v${item.revision}${item.isArchived ? " · archived" : ""} · ${item.mode}`}
                    selected={selectedReportIds.has(
                      reportSelectionKey(item.reportId, item.revision)
                    )}
                    onPress={() => handleToggleReport(report)}
                  />
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "flex h-[85vh] max-h-[85vh] flex-col rounded-t-2xl p-0",
          /* Full width on mobile; centered panel on larger screens (overrides inset-x-0). */
          "left-1/2 right-auto w-full max-w-lg -translate-x-1/2",
          "sm:max-w-xl md:max-w-2xl",
          "border-x shadow-2xl"
        )}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <SheetTitle>{ADD_CONTEXT_TITLE}</SheetTitle>
        </SheetHeader>

        <div className="shrink-0 space-y-2 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {ADD_CONTEXT_SELECTED_SUMMARY(
                selectedCheckpointCount,
                selectedDocumentCount,
                MAX_SELECTED_CHECKPOINTS,
                MAX_SELECTED_DOCUMENTS
              )}
            </p>
            {(selectedCheckpointCount > 0 || selectedDocumentCount > 0) && (
              <button
                type="button"
                className="text-xs text-primary"
                onClick={onClearSelection}
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex rounded-lg bg-muted p-1">
            <TabButton
              label={ADD_CONTEXT_TAB_TIMELINE}
              active={activeTab === "timeline"}
              onPress={() => {
                setActiveTab("timeline");
                setSearchQuery("");
                setLimitHint(null);
              }}
            />
            <TabButton
              label={ADD_CONTEXT_TAB_DOCUMENTS}
              active={activeTab === "documents"}
              onPress={() => {
                setActiveTab("documents");
                setSearchQuery("");
                setLimitHint(null);
              }}
            />
          </div>

          <p className="text-xs leading-4 text-muted-foreground">{modeHint}</p>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
        >
          <div className="mt-4 min-h-[5.5rem]">
            {activeTab === "timeline" ? (
              <div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["camera", "Capture", Camera, onCapturePhoto],
                      ["gallery", "Gallery", Images, onPickGallery],
                      ["video", "Video", Video, onCaptureVideo],
                    ] as const
                  ).map(([kind, label, IconComponent, handler]) => {
                    const isActive = launchingAction === kind;
                    return (
                      <Button
                        key={kind}
                        type="button"
                        variant="outline"
                        disabled={captureBusy}
                        className={cn(
                          "h-auto flex-col gap-1 py-3",
                          isActive && "border-primary bg-primary/10"
                        )}
                        onClick={() => closeAfterAction(kind, handler)}
                      >
                        {isActive ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <IconComponent className="h-5 w-5" />
                        )}
                        <span className="text-xs">{label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={captureBusy}
                  className={cn(
                    "h-auto w-full gap-2 py-3",
                    launchingAction === "upload" && "border-primary bg-primary/10"
                  )}
                  onClick={() => closeAfterAction("upload", onUploadDocument)}
                >
                  {launchingAction === "upload" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                  Upload document
                </Button>
              </div>
            )}
          </div>

          {hasPendingContext ? (
            <div className="mb-2 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Processing {pendingContext.length} item
                {pendingContext.length === 1 ? "" : "s"}
                {pendingSummaryParts.length > 0
                  ? ` (${pendingSummaryParts.join(", ")})`
                  : ""}
                . They will auto-select when ready.
              </p>
            </div>
          ) : null}

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 pr-9"
            />
            {searchQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : null}
          </div>

          {limitHint ? (
            <p className="mb-3 text-xs text-destructive">{limitHint}</p>
          ) : null}

          {activeTab === "timeline" ? renderTimelineList() : renderDocumentsList()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
