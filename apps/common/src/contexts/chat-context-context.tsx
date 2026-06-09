import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Checkpoint,
  Document,
  PendingContextItem,
  PrimaryAgent,
  PropertyReport,
  QueuedChatSend,
} from "../types";
import { isCheckpointReady, isDocumentReady } from "../lib/chat-context-readiness";
import {
  canSelectMoreCheckpoints,
  canSelectMoreDocuments,
  pickDefaultReadyCheckpoint,
  pickDefaultReadyDocument,
  pickDefaultReadyReportForAgent,
} from "../lib/chat-context-picker";
import {
  MAX_SELECTED_CHECKPOINTS,
  MAX_SELECTED_DOCUMENTS,
} from "../lib/chat-context-limits";
import {
  canSelectMoreReports,
  isReportReady,
  MAX_SELECTED_REPORTS,
} from "../lib/chat-context-reports";

export type ToggleSelectionResult = "added" | "removed" | "limit_reached";

type ChatContextValue = {
  readySelectedCheckpoints: Checkpoint[];
  readySelectedDocuments: Document[];
  readySelectedReports: PropertyReport[];
  pendingContext: PendingContextItem[];
  queuedSend: QueuedChatSend | null;
  contextTouched: boolean;
  setContextTouched: (value: boolean) => void;
  toggleCheckpoint: (checkpoint: Checkpoint) => ToggleSelectionResult;
  toggleDocument: (document: Document) => ToggleSelectionResult;
  toggleReport: (report: PropertyReport) => ToggleSelectionResult;
  clearReadySelection: () => void;
  addPendingContext: (item: PendingContextItem) => void;
  removePendingContext: (id: string) => void;
  updatePendingContext: (id: string, patch: Partial<PendingContextItem>) => void;
  setQueuedSend: (value: QueuedChatSend | null) => void;
  maxSelectedCheckpoints: number;
  maxSelectedDocuments: number;
  maxSelectedReports: number;
};

const ChatContextContext = createContext<ChatContextValue | undefined>(undefined);

type ProviderProps = {
  children: React.ReactNode;
  primaryAgent: PrimaryAgent;
  allCheckpoints: Checkpoint[];
  allDocuments: Document[];
  allReports?: PropertyReport[];
  onQueuedSendReady?: (
    queued: QueuedChatSend,
    selection: {
      checkpoints: Checkpoint[];
      documents: Document[];
      reports: PropertyReport[];
    }
  ) => void;
};

function appendCheckpointIfRoom(
  prev: Checkpoint[],
  checkpoint: Checkpoint
): Checkpoint[] {
  if (prev.some((s) => s.id === checkpoint.id)) return prev;
  if (!canSelectMoreCheckpoints(prev.length)) return prev;
  return [...prev, checkpoint];
}

function appendDocumentIfRoom(prev: Document[], document: Document): Document[] {
  if (prev.some((s) => s.id === document.id)) return prev;
  if (!canSelectMoreDocuments(prev.length)) return prev;
  return [...prev, document];
}

function appendReportIfRoom(prev: PropertyReport[], report: PropertyReport): PropertyReport[] {
  if (prev.some((s) => s.id === report.id)) return prev;
  if (!canSelectMoreReports(prev.length)) return prev;
  return [...prev, report];
}

export function ChatContextProvider({
  children,
  primaryAgent,
  allCheckpoints,
  allDocuments,
  allReports = [],
  onQueuedSendReady,
}: ProviderProps) {
  const [readySelectedCheckpoints, setReadySelectedCheckpoints] = useState<Checkpoint[]>([]);
  const [readySelectedDocuments, setReadySelectedDocuments] = useState<Document[]>([]);
  const [readySelectedReports, setReadySelectedReports] = useState<PropertyReport[]>([]);
  const [pendingContext, setPendingContext] = useState<PendingContextItem[]>([]);
  const [queuedSend, setQueuedSend] = useState<QueuedChatSend | null>(null);
  const [contextTouched, setContextTouched] = useState(false);
  const onQueuedSendReadyRef = useRef(onQueuedSendReady);
  onQueuedSendReadyRef.current = onQueuedSendReady;

  useEffect(() => {
    if (primaryAgent === "docs" || primaryAgent === "report") {
      setReadySelectedCheckpoints([]);
    }
    if (primaryAgent === "report") {
      setReadySelectedDocuments([]);
    }
    if (primaryAgent === "docs" || primaryAgent === "checkpoint") {
      setReadySelectedReports([]);
    }
  }, [primaryAgent]);

  // Default: one recent ready checkpoint + document until the user changes selection.
  useEffect(() => {
    if (contextTouched) return;

    const defaultCheckpoint = pickDefaultReadyCheckpoint(allCheckpoints, primaryAgent);
    if (defaultCheckpoint) {
      setReadySelectedCheckpoints((prev) =>
        prev.length > 0 ? prev : [defaultCheckpoint]
      );
    }

    const defaultDocument = pickDefaultReadyDocument(allDocuments, primaryAgent);
    if (defaultDocument) {
      setReadySelectedDocuments((prev) =>
        prev.length > 0 ? prev : [defaultDocument]
      );
    }

    const defaultReport = pickDefaultReadyReportForAgent(allReports, primaryAgent);
    if (defaultReport && isReportReady(defaultReport)) {
      setReadySelectedReports((prev) =>
        prev.length > 0 ? prev : [defaultReport]
      );
    }
  }, [allCheckpoints, allDocuments, allReports, primaryAgent, contextTouched]);

  // Promote pending checkpoints — auto-select only the newly ready item (capped)
  useEffect(() => {
    setPendingContext((prev) => {
      let changed = false;
      const next = prev.filter((item) => {
        if (item.kind !== "checkpoint") return true;
        const cp = allCheckpoints.find((c) => c.id === item.checkpointId);
        if (!cp) return true;
        if (cp.analysisStatus === "failed") {
          changed = true;
          return false;
        }
        if (isCheckpointReady(cp)) {
          changed = true;
          setReadySelectedCheckpoints((sel) => appendCheckpointIfRoom(sel, cp));
          return false;
        }
        return true;
      });
      return changed ? next : prev;
    });
  }, [allCheckpoints]);

  // Promote pending documents — auto-select only the newly ready item (capped)
  useEffect(() => {
    setPendingContext((prev) => {
      let changed = false;
      const next = prev.filter((item) => {
        if (item.kind !== "document") return true;
        const doc = allDocuments.find((d) => d.id === item.docId);
        if (!doc) return true;
        if (doc.status === "failed") {
          changed = true;
          return false;
        }
        if (isDocumentReady(doc)) {
          changed = true;
          setReadySelectedDocuments((sel) => appendDocumentIfRoom(sel, doc));
          return false;
        }
        return true;
      });
      return changed ? next : prev;
    });
  }, [allDocuments]);

  useEffect(() => {
    if (!queuedSend) return;
    const stillPending = queuedSend.waitForIds.some((id) =>
      pendingContext.some((p) => p.id === id)
    );
    if (stillPending) return;

    const checkpoints = readySelectedCheckpoints;
    const documents = readySelectedDocuments;
    const reports = readySelectedReports;
    const queued = queuedSend;
    setQueuedSend(null);
    onQueuedSendReadyRef.current?.(queued, { checkpoints, documents, reports });
  }, [
    queuedSend,
    pendingContext,
    readySelectedCheckpoints,
    readySelectedDocuments,
    readySelectedReports,
  ]);

  const toggleCheckpoint = useCallback((checkpoint: Checkpoint): ToggleSelectionResult => {
    setContextTouched(true);
    let result: ToggleSelectionResult = "removed";
    setReadySelectedCheckpoints((prev) => {
      const exists = prev.some((cp) => cp.id === checkpoint.id);
      if (exists) {
        result = "removed";
        return prev.filter((cp) => cp.id !== checkpoint.id);
      }
      if (!canSelectMoreCheckpoints(prev.length)) {
        result = "limit_reached";
        return prev;
      }
      result = "added";
      return [...prev, checkpoint];
    });
    return result;
  }, []);

  const toggleDocument = useCallback((document: Document): ToggleSelectionResult => {
    setContextTouched(true);
    let result: ToggleSelectionResult = "removed";
    setReadySelectedDocuments((prev) => {
      const exists = prev.some((d) => d.id === document.id);
      if (exists) {
        result = "removed";
        return prev.filter((d) => d.id !== document.id);
      }
      if (!canSelectMoreDocuments(prev.length)) {
        result = "limit_reached";
        return prev;
      }
      result = "added";
      return [...prev, document];
    });
    return result;
  }, []);

  const toggleReport = useCallback((report: PropertyReport): ToggleSelectionResult => {
    setContextTouched(true);
    let result: ToggleSelectionResult = "removed";
    const selectionKey = (item: PropertyReport) =>
      `${item.id}:v${item.revision ?? 1}`;
    setReadySelectedReports((prev) => {
      const sameSlot = prev.findIndex((r) => r.id === report.id);
      const exists = sameSlot >= 0 && selectionKey(prev[sameSlot]) === selectionKey(report);
      if (exists) {
        result = "removed";
        return prev.filter((_, index) => index !== sameSlot);
      }
      if (sameSlot >= 0) {
        result = "added";
        return prev.map((item, index) => (index === sameSlot ? report : item));
      }
      if (!canSelectMoreReports(prev.length)) {
        result = "limit_reached";
        return prev;
      }
      result = "added";
      return [...prev, report];
    });
    return result;
  }, []);

  const clearReadySelection = useCallback(() => {
    setContextTouched(true);
    setReadySelectedCheckpoints([]);
    setReadySelectedDocuments([]);
    setReadySelectedReports([]);
  }, []);

  const addPendingContext = useCallback((item: PendingContextItem) => {
    setContextTouched(true);
    setPendingContext((prev) => [...prev, item]);
  }, []);

  const removePendingContext = useCallback((id: string) => {
    setPendingContext((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePendingContext = useCallback((id: string, patch: Partial<PendingContextItem>) => {
    setPendingContext((prev) =>
      prev.map((p) => (p.id === id ? ({ ...p, ...patch } as PendingContextItem) : p))
    );
  }, []);

  const value = useMemo(
    () => ({
      readySelectedCheckpoints,
      readySelectedDocuments,
      readySelectedReports,
      pendingContext,
      queuedSend,
      contextTouched,
      setContextTouched,
      toggleCheckpoint,
      toggleDocument,
      toggleReport,
      clearReadySelection,
      addPendingContext,
      removePendingContext,
      updatePendingContext,
      setQueuedSend,
      maxSelectedCheckpoints: MAX_SELECTED_CHECKPOINTS,
      maxSelectedDocuments: MAX_SELECTED_DOCUMENTS,
      maxSelectedReports: MAX_SELECTED_REPORTS,
    }),
    [
      readySelectedCheckpoints,
      readySelectedDocuments,
      readySelectedReports,
      pendingContext,
      queuedSend,
      contextTouched,
      toggleCheckpoint,
      toggleDocument,
      toggleReport,
      clearReadySelection,
      addPendingContext,
      removePendingContext,
      updatePendingContext,
    ]
  );

  return <ChatContextContext.Provider value={value}>{children}</ChatContextContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContextContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within ChatContextProvider");
  }
  return ctx;
}
