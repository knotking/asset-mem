import * as React from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ADD_CONTEXT_CAMERA_PHOTO_OPTIONS,
  ADD_CONTEXT_CAMERA_VIDEO_OPTIONS,
  ADD_CONTEXT_GALLERY_OPTIONS,
  warmAddContextMediaPermissions,
} from '@/lib/add-context-media-picker';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import {
  clientMessageTimestampAfter,
  clientStartedAtTimestamp,
  sessionActivityOnUserMessagePatch,
} from '@homeapp/common/lib/session-timestamps';
import { deriveSessionNameFromFirstMessage } from '@homeapp/common/lib/session-name';
import type { IMessage } from 'react-native-gifted-chat';
import { PropertyChatTab } from '@/components/property-details/PropertyChatTab';
import { AddContextSheet } from '@/components/chat/AddContextSheet';
import { ChatContextChipStrip } from '@/components/chat/ChatContextChipStrip';
import { ChatContextProvider, useChatContext } from '@homeapp/common/contexts/chat-context-context';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { useProperty } from '@homeapp/common/contexts/property-context';
import { useDocumentUpload } from '@homeapp/common/contexts/document-upload-context';
import type {
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  PrimaryAgent,
  SearchLocationInput,
} from '@homeapp/common/types';
import {
  buildAgentRequestContext,
  buildMessageContextRefs,
  canSendChatMessage,
  getSendBlockReason,
} from '@homeapp/common/lib/chat-send-context';
import { analyzeCheckpoint, queueExtractDocInfo, postFileToAgent, streamAgentResponse } from '@/lib/api';
import { getDocumentAnalysisFailureMessage } from '@homeapp/common/lib/document-analysis-errors';
import { waitForUserDocAnalysis } from '@/lib/wait-user-doc-analysis';
import { createLogger } from '@/lib/logger';

const chatLog = createLogger('chat');

type Props = {
  sessionId: string | null;
  userId: string;
  propertyId: string;
  propertyAddress?: string;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  onToggleCheckpointOptionalAgent: (agent: CheckpointOptionalAgent) => void;
  isSending: boolean;
  setIsSending: (v: boolean) => void;
  onStop: () => void;
  searchLocation?: SearchLocationInput;
  onSearchLocationChange?: (v: SearchLocationInput | undefined) => void;
  db: ReturnType<typeof import('firebase/firestore').getFirestore>;
  storage: ReturnType<typeof import('firebase/storage').getStorage>;
  onError: (message: string) => void;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
};

function PropertyChatInner(props: Props) {
  const {
    sessionId,
    userId,
    propertyId,
    propertyAddress,
    primaryAgent,
    onPrimaryAgentChange,
    selectedOptionalAgents,
    onToggleOptionalAgent,
    selectedCheckpointOptionalAgents,
    onToggleCheckpointOptionalAgent,
    isSending,
    setIsSending,
    onStop,
    searchLocation,
    onSearchLocationChange,
    db,
    storage,
    onError,
    abortControllerRef,
  } = props;

  const {
    checkpoints,
    createCheckpoint,
    updateCheckpoint,
    loadMoreCheckpoints,
    hasMoreCheckpoints,
    isLoadingEarlier,
  } = useCheckpoint();
  const { documents, property } = useProperty();
  const { uploadDocuments } = useDocumentUpload();
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

  const [addContextVisible, setAddContextVisible] = React.useState(false);
  const runSendRef = React.useRef<(text: string) => Promise<void>>(async () => {});

  React.useEffect(() => {
    if (!addContextVisible) return;
    void warmAddContextMediaPermissions();
  }, [addContextVisible]);

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
      primaryAgent,
      text: 'placeholder',
      readySelectedCheckpoints,
      readySelectedDocuments,
      pendingContext,
    });
    if (!reason || reason === 'Enter a message.') return null;
    return reason;
  }, [primaryAgent, readySelectedCheckpoints, readySelectedDocuments, pendingContext]);

  const runSend = React.useCallback(
    async (text: string) => {
      if (!userId || !sessionId || isSending) return;

      const sendInput = {
        primaryAgent,
        text,
        readySelectedCheckpoints,
        readySelectedDocuments,
        pendingContext,
      };

      if (!canSendChatMessage(sendInput)) {
        const reason = getSendBlockReason(sendInput);
        if (reason && pendingContext.length > 0 && text.trim()) {
          setQueuedSend({
            text: text.trim(),
            waitForIds: pendingContext.map((p) => p.id),
            primaryAgent,
          });
          return;
        }
        if (reason) onError(reason);
        return;
      }

      setIsSending(true);
      setQueuedSend(null);

      try {
        const sessionRef = doc(db, 'users', userId, 'chats', sessionId);
        const sessionDoc = await getDoc(sessionRef);
        const agentSessionId = sessionDoc.data()?.agentSessionId;
        if (!agentSessionId) throw new Error('Agent session ID not found');

        const contextRefs = buildMessageContextRefs({
          readySelectedCheckpoints,
          readySelectedDocuments,
        });
        const { contextDocURIs, checkpointIds } = buildAgentRequestContext({
          primaryAgent,
          readySelectedCheckpoints,
          readySelectedDocuments,
        });

        const isDraftSession = sessionDoc.data()?.name === 'draft';
        if (isDraftSession) {
          await updateDoc(sessionRef, {
            name: deriveSessionNameFromFirstMessage(text.trim()),
            propertyId,
            startedAt: clientStartedAtTimestamp(),
            ...sessionActivityOnUserMessagePatch(),
          });
        } else {
          await updateDoc(sessionRef, sessionActivityOnUserMessagePatch());
        }

        const userCreatedAt = clientStartedAtTimestamp();

        await addDoc(collection(db, 'users', userId, 'chats', sessionId, 'messages'), {
          role: 'user',
          content: text.trim(),
          contentMarkdown: text.trim(),
          contextRefs,
          createdAt: userCreatedAt,
        });

        const assistantMessageRef = await addDoc(
          collection(db, 'users', userId, 'chats', sessionId, 'messages'),
          {
            role: 'assistant',
            content: '',
            createdAt: clientMessageTimestampAfter(userCreatedAt),
            primaryAgent,
          }
        );

        abortControllerRef.current = new AbortController();
        await streamAgentResponse({
          userId,
          agentSessionId,
          userQuery: text.trim(),
          contextDocURIs,
          checkpointIds: checkpointIds.length > 0 ? checkpointIds : undefined,
          propertyAddress,
          propertyId,
          primaryAgent,
          checkpointOptionalAgents:
            selectedCheckpointOptionalAgents.length > 0
              ? selectedCheckpointOptionalAgents
              : undefined,
          searchLocation,
          signal: abortControllerRef.current.signal,
          firebaseChatId: sessionId,
          assistantMessageId: assistantMessageRef.id,
          onError: (error) => {
            updateDoc(assistantMessageRef, { content: `Error: ${error.message}` }).catch(() => {});
            throw error;
          },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        chatLog.error('message.send.failed', undefined, error);
        onError(error instanceof Error ? error.message : 'Failed to send message');
      } finally {
        setIsSending(false);
        abortControllerRef.current = null;
      }
    },
    [
      userId,
      sessionId,
      isSending,
      primaryAgent,
      readySelectedCheckpoints,
      readySelectedDocuments,
      pendingContext,
      db,
      propertyAddress,
      propertyId,
      selectedCheckpointOptionalAgents,
      searchLocation,
      setIsSending,
      onError,
      abortControllerRef,
      setQueuedSend,
    ]
  );

  runSendRef.current = runSend;

  React.useEffect(() => {
    if (!queuedSend) return;
    const stillPending = queuedSend.waitForIds.some((id) =>
      pendingContext.some((p) => p.id === id)
    );
    if (!stillPending) {
      void runSendRef.current(queuedSend.text);
    }
  }, [queuedSend, pendingContext]);

  const handleGiftedChatSend = React.useCallback(
    (messages: IMessage[]) => {
      if (messages.length === 0) return;
      void runSend(messages[0].text ?? '');
    },
    [runSend]
  );

  const startCheckpointFromAsset = React.useCallback(
    async (asset: ImagePicker.ImagePickerAsset, mediaType: 'image' | 'video') => {
      if (!property) return;
      const pendingId = `pending-cp-${Date.now()}`;
      addPendingContext({
        kind: 'checkpoint',
        id: pendingId,
        checkpointId: '',
        localPreviewUri: asset.uri,
        status: 'processing',
        label: 'New capture',
      });

      try {
        const result = await createCheckpoint({ name: '' }, [{ uri: asset.uri, type: mediaType }]);
        await updateCheckpoint(result.id, { analysisStatus: 'pending' });
        removePendingContext(pendingId);
        addPendingContext({
          kind: 'checkpoint',
          id: pendingId,
          checkpointId: result.id,
          localPreviewUri: asset.uri,
          status: 'processing',
          label: 'Checkpoint',
        });

        const firstMedia = result.media?.[0];
        if (firstMedia?.gsURI) {
          await updateCheckpoint(result.id, { analysisStatus: 'processing' });
          await analyzeCheckpoint({
            imageUrl: firstMedia.gsURI,
            contentType: firstMedia.contentType,
            checkpointId: result.id,
            userId,
            propertyId: property.id,
          });
        }
      } catch (error) {
        removePendingContext(pendingId);
        onError(error instanceof Error ? error.message : 'Failed to create checkpoint');
      }
    },
    [property, createCheckpoint, updateCheckpoint, addPendingContext, removePendingContext, userId, onError]
  );

  const handleCapturePhoto = React.useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        onError('Camera permission is required.');
        return false;
      }
      const result = await ImagePicker.launchCameraAsync(ADD_CONTEXT_CAMERA_PHOTO_OPTIONS);
      if (result.canceled || !result.assets?.[0]) return false;
      void startCheckpointFromAsset(result.assets[0], 'image');
      return false;
    } catch (error) {
      chatLog.error('camera.capture.failed', undefined, error);
      onError(error instanceof Error ? error.message : 'Could not open camera.');
      return false;
    }
  }, [startCheckpointFromAsset, onError]);

  const handlePickGallery = React.useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        onError('Media library permission is required.');
        return false;
      }
      const result = await ImagePicker.launchImageLibraryAsync(ADD_CONTEXT_GALLERY_OPTIONS);
      if (result.canceled || !result.assets?.[0]) return false;

      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      void startCheckpointFromAsset(asset, isVideo ? 'video' : 'image');
      return false;
    } catch (error) {
      chatLog.error('gallery.pick.failed', undefined, error);
      onError(error instanceof Error ? error.message : 'Could not open photo library.');
      return false;
    }
  }, [startCheckpointFromAsset, onError]);

  const handleCaptureVideo = React.useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        onError('Camera permission is required.');
        return false;
      }
      const result = await ImagePicker.launchCameraAsync(ADD_CONTEXT_CAMERA_VIDEO_OPTIONS);
      if (result.canceled || !result.assets?.[0]) return false;
      void startCheckpointFromAsset(result.assets[0], 'video');
      return false;
    } catch (error) {
      chatLog.error('camera.video.failed', undefined, error);
      onError(error instanceof Error ? error.message : 'Could not record video.');
      return false;
    }
  }, [startCheckpointFromAsset, onError]);

  const handleUploadDocument = React.useCallback(async (): Promise<boolean> => {
    if (!property || !userId) return false;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return false;

    const asset = result.assets[0];
    const pendingId = `pending-doc-${Date.now()}`;
    addPendingContext({
      kind: 'document',
      id: pendingId,
      docId: '',
      localPreviewUri: asset.uri,
      status: 'uploading',
      label: asset.name,
    });

    void (async () => {
      try {
        await uploadDocuments(
          [
            {
              name: asset.name,
              uri: asset.uri,
              mimeType: asset.mimeType ?? 'application/octet-stream',
              size: asset.size,
            },
          ],
          {
            userId,
            storage,
            onAnalyze: async (_doc, gsURI, meta) => {
              const docRef = await addDoc(collection(db, 'users', userId, 'docs'), {
                userId,
                propertyId: property.id,
                name: asset.name,
                url: meta.downloadURL,
                storagePath: meta.storagePath,
                gsURI,
                contentType: asset.mimeType,
                status: 'analyzing',
                ragIndexed: false,
                summary: 'Processing...',
                createdAt: serverTimestamp(),
              });
              removePendingContext(pendingId);
              addPendingContext({
                kind: 'document',
                id: pendingId,
                docId: docRef.id,
                localPreviewUri: asset.uri,
                status: 'indexing',
                label: asset.name,
              });
              await postFileToAgent(gsURI, userId, docRef.id);
              await queueExtractDocInfo({
                docId: docRef.id,
                docUrl: gsURI,
                contentType: asset.mimeType ?? 'application/octet-stream',
                userId,
              });
              const data = await waitForUserDocAnalysis(db, userId, docRef.id);
              if (data.status === 'failed') {
                throw new Error(
                  typeof data.summary === 'string' ? data.summary : 'Document analysis failed'
                );
              }
              return { firestoreDocId: docRef.id };
            },
          }
        );
      } catch (err) {
        removePendingContext(pendingId);
        onError(getDocumentAnalysisFailureMessage(err));
      }
    })();

    return false;
  }, [
    property,
    userId,
    storage,
    db,
    uploadDocuments,
    addPendingContext,
    removePendingContext,
    onError,
  ]);

  return (
    <>
      <PropertyChatTab
        sessionId={sessionId}
        userId={userId}
        primaryAgent={primaryAgent}
        onPrimaryAgentChange={onPrimaryAgentChange}
        selectedOptionalAgents={selectedOptionalAgents}
        onToggleOptionalAgent={onToggleOptionalAgent}
        selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
        onToggleCheckpointOptionalAgent={onToggleCheckpointOptionalAgent}
        isSending={isSending}
        onStop={onStop}
        searchLocation={searchLocation}
        onSearchLocationChange={onSearchLocationChange}
        propertyAddress={propertyAddress}
        onSend={handleGiftedChatSend}
        onOpenAddContext={() => setAddContextVisible(true)}
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
      <AddContextSheet
        visible={addContextVisible}
        onClose={() => setAddContextVisible(false)}
        primaryAgent={primaryAgent}
        checkpoints={checkpoints}
        documents={documents}
        pendingContext={pendingContext}
        selectedCheckpointIds={selectedCheckpointIds}
        selectedDocumentIds={selectedDocumentIds}
        selectedCheckpointCount={readySelectedCheckpoints.length}
        selectedDocumentCount={readySelectedDocuments.length}
        onToggleCheckpoint={toggleCheckpoint}
        onToggleDocument={toggleDocument}
        onClearSelection={clearReadySelection}
        onCapturePhoto={handleCapturePhoto}
        onCaptureVideo={handleCaptureVideo}
        onPickGallery={handlePickGallery}
        onUploadDocument={handleUploadDocument}
        hasMoreCheckpoints={hasMoreCheckpoints}
        isLoadingMoreCheckpoints={isLoadingEarlier}
        onLoadMoreCheckpoints={() => void loadMoreCheckpoints()}
      />
    </>
  );
}

export function PropertyChatWithContext(props: Props) {
  const { checkpoints } = useCheckpoint();
  const { documents } = useProperty();

  return (
    <ChatContextProvider
      primaryAgent={props.primaryAgent}
      allCheckpoints={checkpoints}
      allDocuments={documents}>
      <PropertyChatInner {...props} />
    </ChatContextProvider>
  );
}
