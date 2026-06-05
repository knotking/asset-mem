"use client";

import * as React from "react";
import { useAuth } from "@/contexts/auth-context";
import { useCheckpoint } from "@/contexts/checkpoint-context";
import { useProperty } from "@/contexts/property-context";
import { ChatContextProvider, useChatContext } from "@/contexts/chat-context-context";
import { AddContextSheet } from "@/components/chat/add-context-sheet";
import { ChatContextChipStrip } from "@/components/chat/chat-context-chip-strip";
import { ChatInput } from "@/components/chat/chat-input";
import { CameraCaptureDialog } from "@/components/chat/camera-capture-dialog";
import type {
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  PrimaryAgent,
  SearchLocationInput,
} from "@/lib/types";
import {
  buildAgentRequestContext,
  buildMessageContextRefs,
  canSendChatMessage,
  getSendBlockReason,
} from "@/lib/chat-send-context";
import { analyzeCheckpoint } from "@/lib/api-checkpoint";
import { postFileToAgent, streamAgentResponse } from "@/lib/api-agent";
import { queueExtractDocInfo } from "@/ai/flows/extract-doc-info";
import { waitForUserDocAnalysis } from "@/lib/wait-user-doc-analysis";
import {
  DOCUMENT_QUOTA_USER_MESSAGE,
  getDocumentAnalysisFailureMessage,
  isDocumentQuotaMessage,
} from "@/lib/plan-limit-errors";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/logger";
import { trackFirstChatMessage } from "@/lib/analytics";
import {
  clientMessageTimestampAfter,
  clientStartedAtTimestamp,
  sessionActivityOnUserMessagePatch,
} from "@/lib/session-timestamps";
import { deriveSessionNameFromFirstMessage } from "@/lib/session-name";

const chatLog = createLogger("chat");

type ComposerProps = {
  sessionId: string;
  propertyId: string;
  propertyAddress?: string;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onOptionalAgentsChange: (agents: AnalysisOptionalAgent[]) => void;
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  onCheckpointOptionalAgentsChange: (agents: CheckpointOptionalAgent[]) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  isNewSession: boolean;
  setIsNewSession: (v: boolean) => void;
  searchLocation?: SearchLocationInput;
  onSearchLocationChange?: (v: SearchLocationInput | undefined) => void;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  onStop: () => void;
};

function PropertyChatComposerInner(
  props: ComposerProps & { composerRef?: React.Ref<PropertyChatComposerHandle> }
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    checkpoints,
    createCheckpoint,
    updateCheckpoint,
    loadMoreCheckpoints,
    hasMoreCheckpoints,
    isLoadingEarlier,
  } = useCheckpoint();
  const { documents, property } = useProperty();
  const {
    readySelectedCheckpoints,
    readySelectedDocuments,
    pendingContext,
    queuedSend,
    toggleCheckpoint,
    toggleDocument,
    clearReadySelection,
    addPendingContext,
    removePendingContext,
    setQueuedSend,
  } = useChatContext();

  const [addContextOpen, setAddContextOpen] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [cameraInitialMode, setCameraInitialMode] = React.useState<"photo" | "video">("photo");
  const cameraFlowResolveRef = React.useRef<((success: boolean) => void) | null>(null);
  const docInputRef = React.useRef<HTMLInputElement>(null);
  const runSendRef = React.useRef<(text: string) => Promise<void>>(async () => {});

  const selectedCheckpointIds = React.useMemo(
    () => new Set(readySelectedCheckpoints.map((c) => c.id!)),
    [readySelectedCheckpoints]
  );
  const selectedDocumentIds = React.useMemo(
    () => new Set(readySelectedDocuments.map((d) => d.id)),
    [readySelectedDocuments]
  );

  const sendBlockHint = React.useMemo(() => {
    const reason = getSendBlockReason({
      primaryAgent: props.primaryAgent,
      text: "placeholder",
      readySelectedCheckpoints,
      readySelectedDocuments,
      pendingContext,
    });
    if (!reason || reason === "Enter a message.") return null;
    return reason;
  }, [props.primaryAgent, readySelectedCheckpoints, readySelectedDocuments, pendingContext]);

  const runSend = React.useCallback(
    async (content: string) => {
      if (!user || props.isLoading) return;

      const sendInput = {
        primaryAgent: props.primaryAgent,
        text: content,
        readySelectedCheckpoints,
        readySelectedDocuments,
        pendingContext,
      };

      if (!canSendChatMessage(sendInput)) {
        const reason = getSendBlockReason(sendInput);
        if (reason && pendingContext.length > 0 && content.trim()) {
          setQueuedSend({
            text: content.trim(),
            waitForIds: pendingContext.map((p) => p.id),
            primaryAgent: props.primaryAgent,
          });
          return;
        }
        if (reason) {
          toast({ variant: "destructive", title: "Cannot send", description: reason });
        }
        return;
      }

      props.setIsLoading(true);
      setQueuedSend(null);
      trackFirstChatMessage();

      let activeSessionId = props.sessionId;

      try {
        const sessionRef = doc(db, "users", user.uid, "chats", activeSessionId);

        if (props.isNewSession) {
          const newName = deriveSessionNameFromFirstMessage(content.trim());
          await updateDoc(sessionRef, {
            name: newName,
            propertyId: props.propertyId,
            startedAt: clientStartedAtTimestamp(),
            ...sessionActivityOnUserMessagePatch(),
          });
          props.setIsNewSession(false);
        } else {
          await updateDoc(sessionRef, sessionActivityOnUserMessagePatch());
        }

        const contextRefs = buildMessageContextRefs({
          readySelectedCheckpoints,
          readySelectedDocuments,
        });
        const { contextDocURIs, checkpointIds } = buildAgentRequestContext({
          primaryAgent: props.primaryAgent,
          readySelectedCheckpoints,
          readySelectedDocuments,
        });

        const userCreatedAt = clientStartedAtTimestamp();

        const userMessageRef = await addDoc(
          collection(db, "users", user.uid, "chats", activeSessionId, "messages"),
          {
            role: "user",
            content: content.trim(),
            contentMarkdown: content.trim(),
            contextRefs,
            createdAt: userCreatedAt,
          }
        );

        const assistantMessageRef = await addDoc(
          collection(db, "users", user.uid, "chats", activeSessionId, "messages"),
          {
            role: "assistant",
            content: "",
            createdAt: clientMessageTimestampAfter(userCreatedAt),
            primaryAgent: props.primaryAgent,
          }
        );

        const sessionDoc = await getDoc(
          doc(db, "users", user.uid, "chats", activeSessionId)
        );
        const agentSessionId = sessionDoc.data()?.agentSessionId;
        if (!agentSessionId) throw new Error("Agent session ID not found");

        props.abortControllerRef.current = new AbortController();
        await streamAgentResponse({
          userId: user.uid,
          agentSessionId,
          userQuery: content.trim(),
          contextDocURIs,
          checkpointIds: checkpointIds.length > 0 ? checkpointIds : undefined,
          propertyAddress: props.propertyAddress,
          propertyId: props.propertyId,
          primaryAgent:
            props.primaryAgent === "docs" || props.primaryAgent === "checkpoint"
              ? props.primaryAgent
              : undefined,
          checkpointOptionalAgents:
            props.primaryAgent === "checkpoint" &&
            props.selectedCheckpointOptionalAgents.length > 0
              ? props.selectedCheckpointOptionalAgents
              : undefined,
          searchLocation: props.searchLocation,
          signal: props.abortControllerRef.current.signal,
          firebaseChatId: activeSessionId,
          assistantMessageId: assistantMessageRef.id,
        });
        void userMessageRef;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return;
        chatLog.error("message.send.failed", undefined, error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        const isQuota = /monthly ai token limit|TOKEN_QUOTA_EXCEEDED/i.test(errorMessage);
        toast({
          variant: "destructive",
          title: isQuota ? "Monthly AI limit reached" : "Error",
          description: errorMessage,
        });
      } finally {
        props.setIsLoading(false);
        props.abortControllerRef.current = null;
      }
    },
    [
      user,
      props,
      readySelectedCheckpoints,
      readySelectedDocuments,
      pendingContext,
      setQueuedSend,
      toast,
    ]
  );

  runSendRef.current = runSend;

  React.useImperativeHandle(props.composerRef, () => ({
    send: (text: string) => {
      void runSendRef.current(text);
    },
  }));

  React.useEffect(() => {
    if (!queuedSend) return;
    const stillPending = queuedSend.waitForIds.some((id) =>
      pendingContext.some((p) => p.id === id)
    );
    if (!stillPending) {
      void runSendRef.current(queuedSend.text);
    }
  }, [queuedSend, pendingContext]);

  const startCheckpointFromFile = React.useCallback(
    async (file: File, previewUrl: string) => {
      if (!property || !user) return;
      const pendingId = `pending-cp-${Date.now()}`;
      const mediaType = file.type.startsWith("video/") ? "video" : "image";

      addPendingContext({
        kind: "checkpoint",
        id: pendingId,
        checkpointId: "",
        localPreviewUri: previewUrl,
        status: "processing",
        label: "New capture",
      });

      try {
        const result = await createCheckpoint({ name: "" }, [
          { uri: previewUrl, type: mediaType },
        ]);
        await updateCheckpoint(result.id, { analysisStatus: "pending" });
        removePendingContext(pendingId);
        addPendingContext({
          kind: "checkpoint",
          id: pendingId,
          checkpointId: result.id,
          localPreviewUri: previewUrl,
          status: "processing",
          label: "Checkpoint",
        });

        const firstMedia = result.media?.[0];
        if (firstMedia?.gsURI) {
          await updateCheckpoint(result.id, { analysisStatus: "processing" });
          await analyzeCheckpoint({
            imageUrl: firstMedia.gsURI,
            contentType: firstMedia.contentType,
            checkpointId: result.id,
            userId: user.uid,
            propertyId: property.id,
          });
        }
      } catch (error) {
        removePendingContext(pendingId);
        toast({
          variant: "destructive",
          title: "Capture failed",
          description: error instanceof Error ? error.message : "Could not create checkpoint",
        });
      }
    },
    [property, user, createCheckpoint, updateCheckpoint, addPendingContext, removePendingContext, toast]
  );

  const resolveCameraFlow = React.useCallback((success: boolean) => {
    cameraFlowResolveRef.current?.(success);
    cameraFlowResolveRef.current = null;
  }, []);

  const handleOpenCamera = React.useCallback((mode: "photo" | "video"): Promise<boolean> => {
    setCameraInitialMode(mode);
    setCameraOpen(true);
    return new Promise((resolve) => {
      cameraFlowResolveRef.current = resolve;
    });
  }, []);

  const handleCameraCapture = React.useCallback(
    (file: File) => {
      const previewUrl = URL.createObjectURL(file);
      resolveCameraFlow(true);
      setCameraOpen(false);
      void startCheckpointFromFile(file, previewUrl);
    },
    [startCheckpointFromFile, resolveCameraFlow]
  );

  const pickFileFromInput = React.useCallback(
    (accept: string): Promise<File | null> =>
      new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        const onWindowFocus = () => {
          window.removeEventListener("focus", onWindowFocus);
          window.setTimeout(() => {
            if (!input.files?.length) resolve(null);
          }, 400);
        };
        input.onchange = () => {
          window.removeEventListener("focus", onWindowFocus);
          resolve(input.files?.[0] ?? null);
        };
        window.addEventListener("focus", onWindowFocus);
        input.click();
      }),
    []
  );

  const handleGalleryPick = React.useCallback(async (): Promise<boolean> => {
    const file = await pickFileFromInput("image/*,video/*");
    if (!file) return false;
    const previewUrl = URL.createObjectURL(file);
    void startCheckpointFromFile(file, previewUrl);
    return false;
  }, [pickFileFromInput, startCheckpointFromFile]);

  const handleUploadDocument = React.useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      const input = docInputRef.current;
      if (!input) {
        resolve(false);
        return;
      }
      const onWindowFocus = () => {
        window.removeEventListener("focus", onWindowFocus);
        window.setTimeout(() => {
          if (!input.files?.length) resolve(false);
        }, 400);
      };
      const onChange = () => {
        window.removeEventListener("focus", onWindowFocus);
        resolve(false);
      };
      input.addEventListener("change", onChange, { once: true });
      window.addEventListener("focus", onWindowFocus);
      input.click();
    });
  }, []);

  const handleDocumentSelected = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !property || !user) return;

      const pendingId = `pending-doc-${Date.now()}`;
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;

      addPendingContext({
        kind: "document",
        id: pendingId,
        docId: "",
        localPreviewUri: previewUrl,
        status: "uploading",
        label: file.name,
      });

      try {
        const docRef = await addDoc(collection(db, "users", user.uid, "docs"), {
          userId: user.uid,
          propertyId: property.id,
          name: file.name,
          contentType: file.type,
          createdAt: serverTimestamp(),
          status: "uploading",
          ragIndexed: false,
          url: "",
          storagePath: "",
          summary: "Processing...",
        });

        const storageRef = ref(
          storage,
          `documents/${user.uid}/${Date.now()}_${file.name}`
        );
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type,
        });
        await uploadTask;
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const gsURI = `gs://${uploadTask.snapshot.ref.bucket}/${uploadTask.snapshot.ref.fullPath}`;

        await updateDoc(doc(db, "users", user.uid, "docs", docRef.id), {
          url: downloadURL,
          storagePath: uploadTask.snapshot.ref.fullPath,
          gsURI,
          status: "analyzing",
        });

        removePendingContext(pendingId);
        addPendingContext({
          kind: "document",
          id: pendingId,
          docId: docRef.id,
          localPreviewUri: previewUrl,
          status: "indexing",
          label: file.name,
        });

        const idToken = await user.getIdToken();
        const ragResult = await postFileToAgent(gsURI, user.uid, docRef.id);
        const queued = await queueExtractDocInfo(
          {
            docId: docRef.id,
            docUrl: gsURI,
            contentType: file.type,
            userId: user.uid,
          },
          idToken
        );

        const quotaMessage =
          (!queued.ok && queued.error) ||
          (ragResult.error && isDocumentQuotaMessage(ragResult.error))
            ? queued.error ?? ragResult.error ?? DOCUMENT_QUOTA_USER_MESSAGE
            : null;
        if (quotaMessage) throw new Error(quotaMessage);
        if (!queued.ok) {
          throw new Error(queued.error ?? "Document analysis was not accepted");
        }

        const docSnap = await waitForUserDocAnalysis(db, user.uid, docRef.id);
        if (docSnap.status === "failed") {
          throw new Error(
            typeof docSnap.summary === "string"
              ? docSnap.summary
              : "Document analysis failed"
          );
        }
      } catch (err) {
        removePendingContext(pendingId);
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: getDocumentAnalysisFailureMessage(err),
        });
      }
    },
    [property, user, addPendingContext, removePendingContext, toast]
  );

  return (
    <>
      <footer className="flex items-center border-t bg-card p-4">
        <ChatInput
          onSend={(text) => void runSend(text)}
          isLoading={props.isLoading}
          onStop={props.onStop}
          placeholder="Type a message…"
          primaryAgent={props.primaryAgent}
          onPrimaryAgentChange={props.onPrimaryAgentChange}
          selectedOptionalAgents={props.selectedOptionalAgents}
          onOptionalAgentsChange={props.onOptionalAgentsChange}
          selectedCheckpointOptionalAgents={props.selectedCheckpointOptionalAgents}
          onCheckpointOptionalAgentsChange={props.onCheckpointOptionalAgentsChange}
          searchLocation={props.searchLocation}
          onSearchLocationChange={props.onSearchLocationChange}
          propertyAddress={props.propertyAddress}
          onOpenAddContext={() => setAddContextOpen(true)}
          contextChipStrip={
            <ChatContextChipStrip
              pendingContext={pendingContext}
              readySelectedCheckpoints={readySelectedCheckpoints}
              readySelectedDocuments={readySelectedDocuments}
              queuedSend={queuedSend}
              onToggleCheckpoint={toggleCheckpoint}
              onToggleDocument={toggleDocument}
              onRemovePending={removePendingContext}
              onClearReady={clearReadySelection}
              onCancelQueuedSend={() => setQueuedSend(null)}
            />
          }
          sendBlockHint={sendBlockHint}
        />
      </footer>

      <AddContextSheet
        open={addContextOpen}
        onOpenChange={setAddContextOpen}
        primaryAgent={props.primaryAgent}
        checkpoints={checkpoints ?? []}
        documents={documents}
        pendingContext={pendingContext}
        selectedCheckpointIds={selectedCheckpointIds}
        selectedDocumentIds={selectedDocumentIds}
        selectedCheckpointCount={readySelectedCheckpoints.length}
        selectedDocumentCount={readySelectedDocuments.length}
        onToggleCheckpoint={toggleCheckpoint}
        onToggleDocument={toggleDocument}
        onClearSelection={clearReadySelection}
        onCapturePhoto={() => handleOpenCamera("photo")}
        onCaptureVideo={() => handleOpenCamera("video")}
        onPickGallery={handleGalleryPick}
        onUploadDocument={handleUploadDocument}
        hasMoreCheckpoints={hasMoreCheckpoints}
        isLoadingMoreCheckpoints={isLoadingEarlier}
        onLoadMoreCheckpoints={() => void loadMoreCheckpoints()}
      />

      <CameraCaptureDialog
        open={cameraOpen}
        initialMode={cameraInitialMode}
        onOpenChange={(open) => {
          setCameraOpen(open);
          if (!open) resolveCameraFlow(false);
        }}
        onCapture={handleCameraCapture}
      />

      <input
        ref={docInputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/*"
        onChange={handleDocumentSelected}
      />
    </>
  );
}

export type PropertyChatComposerHandle = {
  send: (text: string) => void;
};

export const PropertyChatComposer = React.forwardRef<
  PropertyChatComposerHandle,
  ComposerProps
>(function PropertyChatComposer(props, ref) {
  const { checkpoints } = useCheckpoint();
  const { documents } = useProperty();

  return (
    <ChatContextProvider
      primaryAgent={props.primaryAgent}
      allCheckpoints={checkpoints ?? []}
      allDocuments={documents}
    >
      <PropertyChatComposerInner {...props} composerRef={ref} />
    </ChatContextProvider>
  );
});
