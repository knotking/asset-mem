import { Text } from '@/components/ui/text';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ScrollView, View, Pressable, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  MessageSquare,
  FileText,
  Plus,
  File,
  X,
  Camera,
  Clock,
  Users,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePropertiesList } from '@homeapp/common/contexts/properties-list-context';
import { useProperty } from '@homeapp/common/contexts/property-context';
import { useSession } from '@homeapp/common/contexts/session-context';
import { MessagesProvider } from '@homeapp/common/contexts/messages-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import PushDrawer from '@/components/PushDrawer';
import type {
  Document,
  Session,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  SearchLocationInput,
  Checkpoint,
  PrimaryAgent,
} from '@homeapp/common/types';
import { ANALYSIS_OPTIONAL_AGENTS, CHECKPOINT_OPTIONAL_AGENTS } from '@homeapp/common/types';
import { defaultSearchLocationInput } from '@homeapp/common/lib/search-location';
import { streamAgentResponse } from '@/lib/api';
import type { IMessage } from 'react-native-gifted-chat';
import { createLogger } from '@/lib/logger';

const chatLog = createLogger('chat');
const propertyLog = createLogger('property');
import { CameraModal } from '@/components/property-details/CameraModal';
import { PropertyDetailsTab } from '@/components/property-details/PropertyDetailsTab';
import { PropertySavedProvidersTab } from '@/components/property-details/PropertySavedProvidersTab';
import { parsePropertyScreenTab, type PropertyScreenTab } from '@/components/property-details/property-screen-tab';
import { PropertyChatTab } from '@/components/property-details/PropertyChatTab';
import { useSavedServiceProviders } from '@homeapp/common/contexts/saved-service-providers-context';
import { SessionsDrawerContent } from '@/components/property-details/SessionsDrawerContent';
import { DocumentsDrawerContent } from '@/components/property-details/DocumentsDrawerContent';
import { AlertDialogWrapper } from '@/components/property-details/AlertDialogWrapper';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useDocumentAutoUpload } from '@/hooks/useDocumentAutoUpload';
import { useSessionSelection } from '@/hooks/useSessionSelection';
import { CheckpointProvider, useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { PropertyCheckpointsTab } from '@/components/property-details/PropertyCheckpointsTab';
import { CheckpointsDrawerContent } from '@/components/property-details/CheckpointsDrawerContent';
import { TokenUsageBar } from '@/components/TokenUsageBar';
import PropertyListSkeleton from '@/components/PropertyListSkeleton';
import { peekPendingPropertyUpload } from '@/lib/pending-property-upload';
import { PENDING_PROPERTY_ADDRESS } from '@/lib/property-address-placeholder';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { ONBOARDING_CHAT_OPEN_PARAM } from '@homeapp/common/lib/home-onboarding';

function normalizeRouteParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function PropertyDetailsScreen() {
  const params = useLocalSearchParams<{
    id: string | string[];
    new?: string | string[];
    files?: string | string[];
    tab?: string | string[];
    sessionId?: string | string[];
    fromOnboardingChecklist?: string | string[];
  }>();
  const propertyId = normalizeRouteParam(params.id);
  const isNew = normalizeRouteParam(params.new);
  const files = params.files;
  const tab = normalizeRouteParam(params.tab);
  const sessionId = normalizeRouteParam(params.sessionId);
  const fromOnboardingChecklist = normalizeRouteParam(params.fromOnboardingChecklist);

  const { properties } = usePropertiesList();
  const { draftsByProperty, createPropertyDraftSession, sessionsByProperty } = useSession();
  const { documents, property: firestoreProperty, isLoading: isPropertyLoading } = useProperty();
  const { user } = useAuth();
  const { updatePreferences } = usePreferences();
  const { db, storage } = useFirebase();
  const router = useRouter();
  const isNewPropertyFlow = propertyId === 'new-property';

  React.useEffect(() => {
    if (isNewPropertyFlow) {
      router.replace({
        pathname: '/home',
        params: { openAddProperty: '1' },
      });
    }
  }, [isNewPropertyFlow, router]);

  // Tab state
  const [activeTab, setActiveTab] = React.useState<PropertyScreenTab>(() =>
    parsePropertyScreenTab(tab, isNew === 'true', propertyId)
  );

  React.useEffect(() => {
    if (fromOnboardingChecklist !== '1' || activeTab !== 'chat') {
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => {
      void updatePreferences({ onboardingChatOpened: true }).then(() => {
        router.setParams({
          [ONBOARDING_CHAT_OPEN_PARAM]: undefined,
        } as Record<string, string | undefined>);
      });
    });
    return () => task.cancel();
  }, [fromOnboardingChecklist, activeTab, updatePreferences, router]);

  // Drawer state
  const [documentsDrawerVisible, setDocumentsDrawerVisible] = React.useState(false);
  const [sessionsDrawerVisible, setSessionsDrawerVisible] = React.useState(false);
  const [checkpointsDrawerVisible, setCheckpointsDrawerVisible] = React.useState(false);

  // Document selection state
  const [selectedDocuments, setSelectedDocuments] = React.useState<Document[]>([]);
  const [hasManuallyInteracted, setHasManuallyInteracted] = React.useState(false);

  // Checkpoint selection state
  const [selectedCheckpoints, setSelectedCheckpoints] = React.useState<Checkpoint[]>([]);

  // Checkpoint modal state
  const [isCreateCheckpointModalVisible, setIsCreateCheckpointModalVisible] = React.useState(false);

  // Primary agent state
  const [primaryAgent, setPrimaryAgent] = React.useState<PrimaryAgent>('checkpoint');

  // Agent selection state
  const [selectedOptionalAgents, setSelectedOptionalAgents] = React.useState<
    AnalysisOptionalAgent[]
  >(() => [...ANALYSIS_OPTIONAL_AGENTS]);

  const [selectedCheckpointOptionalAgents, setSelectedCheckpointOptionalAgents] = React.useState<
    CheckpointOptionalAgent[]
  >([]);

  // Message sending state
  const [isSending, setIsSending] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [errorAlertOpen, setErrorAlertOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [cameraModalVisible, setCameraModalVisible] = React.useState(false);
  const [searchLocation, setSearchLocation] = React.useState<SearchLocationInput | undefined>(
    undefined
  );

  // Refs
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Custom hooks
  const { selectedSessionId, setSelectedSessionId } = useSessionSelection(propertyId ?? '', sessionId);
  const { fileAttachment, uploadAsset, uploadDocument, removeAttachment, setFileAttachment } =
    useFileUpload(storage, user?.uid);

  // Auto-upload documents from AddPropertyModal
  useDocumentAutoUpload({
    files,
    userId: user?.uid,
    propertyId,
    db,
    storage,
    clearFilesParam: () => router.setParams({ files: undefined } as any),
  });

  // Auto-select all documents by default when documents are loaded
  React.useEffect(() => {
    if (
      documents &&
      documents.length > 0 &&
      selectedDocuments.length === 0 &&
      !hasManuallyInteracted
    ) {
      setSelectedDocuments(documents);
    }
  }, [documents, selectedDocuments.length, hasManuallyInteracted]);

  React.useEffect(() => {
    if (selectedSessionId && !searchLocation) {
      setSearchLocation(defaultSearchLocationInput());
    }
  }, [selectedSessionId, searchLocation]);

  // Clear checkpoint resources when Docs agent is selected
  React.useEffect(() => {
    if (primaryAgent === 'docs') {
      setSelectedCheckpoints([]);
    }
  }, [primaryAgent]);

  const handleTakePhoto = React.useCallback(async () => {
    try {
      if (!user) return;

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Please grant permission to access your camera.');
        setErrorAlertOpen(true);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      await uploadAsset(result.assets[0]);
    } catch (error) {
      propertyLog.error('camera.photo.failed', undefined, error);
      setErrorMessage(`Camera error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setErrorAlertOpen(true);
    }
  }, [user, uploadAsset]);

  const handleRecordVideo = React.useCallback(async () => {
    try {
      if (!user) return;
      setCameraModalVisible(true);
    } catch (error) {
      propertyLog.error('camera.video.failed', undefined, error);
      setErrorMessage(`Camera error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setErrorAlertOpen(true);
    }
  }, [user]);

  const handleVideoRecorded = React.useCallback(
    async (videoUri: string) => {
      setCameraModalVisible(false);

      const timestamp = Date.now();
      const fileName = `video-${timestamp}.mp4`;

      const mockAsset: ImagePicker.ImagePickerAsset = {
        uri: videoUri,
        type: 'video' as const,
        fileName: fileName,
        fileSize: 0,
        mimeType: 'video/mp4',
        width: 0,
        height: 0,
      };

      await uploadAsset(mockAsset);
    },
    [uploadAsset]
  );

  const handleSelectFromLibrary = React.useCallback(async () => {
    if (!user) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErrorMessage('Please grant permission to access your media library.');
      setErrorAlertOpen(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    await uploadAsset(result.assets[0]);
  }, [user, uploadAsset]);

  const handleSelectFiles = React.useCallback(async () => {
    if (!user) return;

    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'video/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      await uploadDocument(result.assets[0]);
    } catch (error) {
      propertyLog.error('file.pick.failed', undefined, error);
      setErrorMessage('Failed to select file. Please try again.');
      setErrorAlertOpen(true);
    }
  }, [user, uploadDocument]);

  const removeFileAttachment = React.useCallback(async () => {
    if (!fileAttachment) return;

    if (fileAttachment.storagePath && fileAttachment.downloadURL) {
      const fileRef = ref(storage, fileAttachment.storagePath);
      try {
        await deleteObject(fileRef);
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          propertyLog.error('file.storageDelete.failed', undefined, error);
        }
      }
    }

    removeAttachment();
  }, [fileAttachment, storage, removeAttachment]);

  const toggleOptionalAgent = React.useCallback((agent: AnalysisOptionalAgent) => {
    setSelectedOptionalAgents((prev) => {
      const isSelected = prev.includes(agent);
      const next = isSelected ? prev.filter((item) => item !== agent) : [...prev, agent];
      return ANALYSIS_OPTIONAL_AGENTS.filter((item) => next.includes(item));
    });
  }, []);

  const toggleCheckpointOptionalAgent = React.useCallback((agent: CheckpointOptionalAgent) => {
    setSelectedCheckpointOptionalAgents((prev) => {
      const isSelected = prev.includes(agent);
      const next = isSelected ? prev.filter((item) => item !== agent) : [...prev, agent];
      return CHECKPOINT_OPTIONAL_AGENTS.filter((item) => next.includes(item));
    });
  }, []);

  const handleStop = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }
  }, []);

  const handleSendMessage = React.useCallback(
    async (textOverride?: string) => {
      const messageText = textOverride !== undefined ? textOverride : message;
      const hasContent =
        messageText.trim() || (fileAttachment?.downloadURL && !fileAttachment?.error);
      if (!user || !selectedSessionId || !hasContent || isSending) return;

      if (fileAttachment && (!fileAttachment.downloadURL || fileAttachment.error)) {
        setErrorMessage('Please wait for the file to finish uploading.');
        setErrorAlertOpen(true);
        return;
      }

      setIsSending(true);
      const userMessage = messageText;
      const currentFileAttachment = fileAttachment;
      setMessage('');
      setFileAttachment(null);

      try {
        const sessionRef = doc(db, 'users', user.uid, 'chats', selectedSessionId);
        const sessionDoc = await getDoc(sessionRef);
        const sessionData = sessionDoc.data();

        if (sessionDoc.exists() && sessionData?.name === 'draft') {
          const newName = `session: ${new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}`;
          await updateDoc(sessionRef, {
            name: newName,
            propertyId: propertyId!,
          });
        }

        const agentSessionId = sessionData?.agentSessionId;
        if (!agentSessionId) {
          throw new Error('Agent session ID not found');
        }

        let fileData = undefined;
        if (currentFileAttachment && currentFileAttachment.downloadURL) {
          const storageRef = ref(storage, currentFileAttachment.storagePath);
          fileData = {
            name: currentFileAttachment.fileName,
            type: currentFileAttachment.fileType,
            url: currentFileAttachment.downloadURL,
            gsURI: `gs://${storageRef.bucket}/${storageRef.fullPath}`,
            width: currentFileAttachment.width,
            height: currentFileAttachment.height,
          };
        }

        await addDoc(collection(db, 'users', user.uid, 'chats', selectedSessionId, 'messages'), {
          role: 'user',
          content: userMessage,
          contentMarkdown: userMessage,
          createdAt: serverTimestamp(),
          ...(fileData && { file: fileData }),
        });

        const assistantMessageRef = await addDoc(
          collection(db, 'users', user.uid, 'chats', selectedSessionId, 'messages'),
          {
            role: 'assistant',
            content: '',
            createdAt: serverTimestamp(),
            primaryAgent,
          }
        );
        const assistantMessageId = assistantMessageRef.id;

        const contextDocURIs = [
          ...selectedDocuments.map((doc) => doc.gsURI).filter((uri): uri is string => !!uri),
          ...(fileData?.gsURI ? [fileData.gsURI] : []),
        ];

        const currentProperty = properties.find((p) => p.id === propertyId);
        const propertyAddress = currentProperty?.address;

        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        const queryText = userMessage || 'What can you tell me about this?';

        const checkpointIds = selectedCheckpoints
          .map((cp) => cp.id)
          .filter((id): id is string => !!id);

        await streamAgentResponse({
          userId: user.uid,
          agentSessionId,
          userQuery: queryText,
          contextDocURIs,
          checkpointIds: checkpointIds.length > 0 ? checkpointIds : undefined,
          propertyAddress,
          propertyId: propertyId!,
          primaryAgent,
          checkpointOptionalAgents:
            selectedCheckpointOptionalAgents.length > 0
              ? selectedCheckpointOptionalAgents
              : undefined,
          searchLocation,
          signal,
          firebaseChatId: selectedSessionId,
          assistantMessageId,
          onError: (error) => {
            updateDoc(assistantMessageRef, {
              content: `Error: ${error.message}`,
            }).catch((err) => chatLog.error('assistant.errorMessageUpdate.failed', undefined, err));
            throw error;
          },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          chatLog.debug('message.send.aborted');
          return;
        }

        chatLog.error('message.send.failed', undefined, error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(
          /monthly ai token limit|monthly ai usage limit/i.test(errMsg)
            ? errMsg
            : `Failed to send message: ${errMsg}`
        );
        setErrorAlertOpen(true);
        setMessage(userMessage);
        setFileAttachment(currentFileAttachment);
      } finally {
        setIsSending(false);
        abortControllerRef.current = null;
      }
    },
    [
      user,
      selectedSessionId,
      message,
      isSending,
      fileAttachment,
      db,
      storage,
      propertyId,
      selectedDocuments,
      selectedCheckpoints,
      properties,
      selectedCheckpointOptionalAgents,
      primaryAgent,
      searchLocation,
      setFileAttachment,
    ]
  );

  const handleGiftedChatSend = React.useCallback(
    (giftedMessages: IMessage[]) => {
      if (giftedMessages.length === 0) return;
      const text = giftedMessages[0].text;
      setMessage(text);
      void handleSendMessage(text);
    },
    [handleSendMessage]
  );

  const toggleDocumentSelection = (document: Document) => {
    setHasManuallyInteracted(true);
    setSelectedDocuments((prev) => {
      const isSelected = prev.some((doc) => doc.id === document.id);
      if (isSelected) {
        return prev.filter((doc) => doc.id !== document.id);
      } else {
        return [...prev, document];
      }
    });
  };

  const toggleCheckpointSelection = (checkpoint: Checkpoint) => {
    setSelectedCheckpoints((prev) => {
      const isSelected = prev.some((cp) => cp.id === checkpoint.id);
      if (isSelected) {
        return prev.filter((cp) => cp.id !== checkpoint.id);
      } else {
        return [...prev, checkpoint];
      }
    });
  };

  if (isNewPropertyFlow) {
    return null;
  }

  if (!propertyId) {
    return null;
  }

  const pendingUpload = propertyId ? peekPendingPropertyUpload(propertyId) : null;
  const listProperty = properties.find((p) => p.id === propertyId);
  let property =
    listProperty ??
    (firestoreProperty?.id === propertyId ? firestoreProperty : null);

  if (
    !property &&
    propertyId &&
    (pendingUpload?.length || isNew === 'true' || isPropertyLoading)
  ) {
    property = {
      id: propertyId,
      name: firestoreProperty?.name ?? 'New Property',
      address: firestoreProperty?.address ?? PENDING_PROPERTY_ADDRESS,
      userId: user?.uid,
    };
  }

  if (!property) {
    if (isNew === 'true' || isPropertyLoading) {
      return (
        <>
          <Stack.Screen options={{ headerShown: false }} />
          <PropertyListSkeleton />
        </>
      );
    }
    return (
      <SafeAreaView className="flex-1 bg-light-background-alt" edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-foreground">Property not found</Text>
          <Button onPress={() => router.back()} variant="default" className="mt-4">
            <Text className="text-primary-foreground">Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <CheckpointProvider>
      <PropertyDetailsScreenContent
        id={propertyId}
        property={property}
        properties={properties}
        documents={documents}
        selectedDocuments={selectedDocuments}
        selectedCheckpoints={selectedCheckpoints}
        toggleDocumentSelection={toggleDocumentSelection}
        toggleCheckpointSelection={toggleCheckpointSelection}
        setSelectedDocuments={setSelectedDocuments}
        setSelectedCheckpoints={setSelectedCheckpoints}
        documentsDrawerVisible={documentsDrawerVisible}
        setDocumentsDrawerVisible={setDocumentsDrawerVisible}
        checkpointsDrawerVisible={checkpointsDrawerVisible}
        setCheckpointsDrawerVisible={setCheckpointsDrawerVisible}
        sessionsDrawerVisible={sessionsDrawerVisible}
        setSessionsDrawerVisible={setSessionsDrawerVisible}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCreateCheckpointModalVisible={isCreateCheckpointModalVisible}
        setIsCreateCheckpointModalVisible={setIsCreateCheckpointModalVisible}
        selectedSessionId={selectedSessionId}
        setSelectedSessionId={setSelectedSessionId}
        sessionsByProperty={sessionsByProperty}
        draftsByProperty={draftsByProperty}
        createPropertyDraftSession={createPropertyDraftSession}
        hasManuallyInteracted={hasManuallyInteracted}
        setHasManuallyInteracted={setHasManuallyInteracted}
        primaryAgent={primaryAgent}
        setPrimaryAgent={setPrimaryAgent}
        selectedOptionalAgents={selectedOptionalAgents}
        setSelectedOptionalAgents={setSelectedOptionalAgents}
        selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
        toggleCheckpointOptionalAgent={toggleCheckpointOptionalAgent}
        isSending={isSending}
        message={message}
        setMessage={setMessage}
        fileAttachment={fileAttachment}
        setFileAttachment={setFileAttachment}
        cameraModalVisible={cameraModalVisible}
        setCameraModalVisible={setCameraModalVisible}
        errorAlertOpen={errorAlertOpen}
        setErrorAlertOpen={setErrorAlertOpen}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
        handleSendMessage={handleSendMessage}
        handleGiftedChatSend={handleGiftedChatSend}
        handleVideoRecorded={handleVideoRecorded}
        removeFileAttachment={removeFileAttachment}
        toggleOptionalAgent={toggleOptionalAgent}
        handleStop={handleStop}
        handleTakePhoto={handleTakePhoto}
        handleRecordVideo={handleRecordVideo}
        handleSelectFromLibrary={handleSelectFromLibrary}
        handleSelectFiles={handleSelectFiles}
        searchLocation={searchLocation}
        setSearchLocation={setSearchLocation}
        router={router}
        user={user}
        db={db}
        storage={storage}
      />
    </CheckpointProvider>
  );
}

// Inner component that can use useCheckpoint hook
function PropertyDetailsScreenContent({
  id,
  property,
  properties,
  documents,
  selectedDocuments,
  selectedCheckpoints,
  toggleDocumentSelection,
  toggleCheckpointSelection,
  setSelectedDocuments,
  setSelectedCheckpoints,
  documentsDrawerVisible,
  setDocumentsDrawerVisible,
  checkpointsDrawerVisible,
  setCheckpointsDrawerVisible,
  sessionsDrawerVisible,
  setSessionsDrawerVisible,
  activeTab,
  setActiveTab,
  isCreateCheckpointModalVisible,
  setIsCreateCheckpointModalVisible,
  selectedSessionId,
  setSelectedSessionId,
  sessionsByProperty,
  draftsByProperty,
  createPropertyDraftSession,
  hasManuallyInteracted,
  setHasManuallyInteracted,
  primaryAgent,
  setPrimaryAgent,
  selectedOptionalAgents,
  setSelectedOptionalAgents,
  selectedCheckpointOptionalAgents,
  toggleCheckpointOptionalAgent,
  isSending,
  message,
  setMessage,
  fileAttachment,
  setFileAttachment,
  cameraModalVisible,
  setCameraModalVisible,
  errorAlertOpen,
  setErrorAlertOpen,
  errorMessage,
  setErrorMessage,
  handleSendMessage,
  handleGiftedChatSend,
  handleVideoRecorded,
  removeFileAttachment,
  toggleOptionalAgent,
  handleStop,
  handleTakePhoto,
  handleRecordVideo,
  handleSelectFromLibrary,
  handleSelectFiles,
  searchLocation,
  setSearchLocation,
  router,
  user,
  db,
  storage,
}: any) {
  const { checkpoints } = useCheckpoint();
  const { savedProviders } = useSavedServiceProviders();

  // Smart checkpoint selection: Auto-select when checkpoint agent is active
  React.useEffect(() => {
    if (primaryAgent === 'checkpoint') {
      // When checkpoint agent is selected, auto-select all checkpoints
      if (
        checkpoints &&
        checkpoints.length > 0 &&
        selectedCheckpoints.length === 0 &&
        !hasManuallyInteracted
      ) {
        setSelectedCheckpoints(checkpoints);
      }
    }
  }, [
    checkpoints,
    selectedCheckpoints.length,
    hasManuallyInteracted,
    setSelectedCheckpoints,
    primaryAgent,
  ]);

  // Handle checkpoint selection when switching agents
  React.useEffect(() => {
    if (primaryAgent === 'checkpoint' && checkpoints && checkpoints.length > 0) {
      // If user switches to checkpoint agent and no checkpoints are selected, auto-select all
      if (selectedCheckpoints.length === 0 && !hasManuallyInteracted) {
        setSelectedCheckpoints(checkpoints);
      }
    } else if (primaryAgent === 'analysis') {
      // Clear checkpoints when switching to analysis agent
      if (selectedCheckpoints.length > 0) {
        setSelectedCheckpoints([]);
      }
    }
  }, [
    primaryAgent,
    checkpoints,
    selectedCheckpoints.length,
    hasManuallyInteracted,
    setSelectedCheckpoints,
  ]);

  return (
    <PushDrawer
      visible={checkpointsDrawerVisible}
      onClose={() => setCheckpointsDrawerVisible(false)}
      width={75}
      direction="right"
      mainContent={
        <PushDrawer
          visible={documentsDrawerVisible}
          onClose={() => setDocumentsDrawerVisible(false)}
          width={75}
          direction="right"
          mainContent={
            <PushDrawer
              visible={sessionsDrawerVisible}
              onClose={() => setSessionsDrawerVisible(false)}
              width={80}
              direction="left"
              mainContent={
                <SafeAreaView
                  className="flex-1 bg-light-background-alt"
                  edges={['top', 'left', 'right']}>
                  <Stack.Screen
                    options={{
                      headerShown: false,
                    }}
                  />

                  {/* Navigation Header */}
                  <View className="bg-light-background-alt px-4 py-3">
                    <View
                      className="flex-row items-center justify-between"
                      style={{ minHeight: 40 }}>
                      <Button onPress={() => router.back()} variant="ghost" size="icon">
                        <Icon as={ArrowLeft} size={24} className="text-foreground" />
                      </Button>
                      <View className="mx-2 min-w-0 flex-1">
                        <Text
                          className="text-center text-xl font-bold text-foreground"
                          numberOfLines={1}>
                          {property.name}
                        </Text>
                      </View>
                      <View className="shrink-0 flex-row items-center gap-1.5">
                        <TokenUsageBar matchActionIconSize />
                        {activeTab === 'chat' && (
                          <View className="flex-row items-center gap-1 rounded-lg border border-border/50 px-1">
                            <View className="relative">
                              <Button
                                onPress={() => setSessionsDrawerVisible(true)}
                                variant="ghost"
                                size="icon">
                                <Icon as={MessageSquare} size={20} className="text-foreground" />
                              </Button>
                              {sessionsByProperty[id] && sessionsByProperty[id].length > 0 && (
                                <View className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 py-0.5">
                                  <Text className="text-center text-[10px] font-semibold text-primary-foreground">
                                    {sessionsByProperty[id].length}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Button
                              onPress={async () => {
                                if (!user) return;
                                if (draftsByProperty[id]) {
                                  setSelectedSessionId(draftsByProperty[id].id);
                                } else {
                                  const newSessionId = await createPropertyDraftSession(
                                    user.uid,
                                    id
                                  );
                                  if (newSessionId) {
                                    setSelectedSessionId(newSessionId);
                                  }
                                }
                              }}
                              variant="ghost"
                              size="icon">
                              <Icon as={Plus} size={20} className="text-foreground" />
                            </Button>
                          </View>
                        )}
                        {activeTab === 'timeline' && (
                          <Button
                            onPress={() => setIsCreateCheckpointModalVisible(true)}
                            variant="ghost"
                            size="icon"
                            className="items-center justify-center">
                            <Icon as={Plus} size={20} className="text-foreground" />
                          </Button>
                        )}
                        {activeTab !== 'timeline' && activeTab !== 'providers' && (
                          <>
                            <View className="relative items-center justify-center">
                              <Button
                                onPress={() => setDocumentsDrawerVisible(true)}
                                variant="ghost"
                                size="icon"
                                className="items-center justify-center">
                                <Icon as={File} size={20} className="text-foreground" />
                              </Button>
                              {((activeTab === 'chat' && selectedDocuments.length > 0) ||
                                (activeTab === 'details' && documents.length > 0)) && (
                                <View className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 py-0.5">
                                  <Text className="text-center text-[10px] font-semibold text-primary-foreground">
                                    {activeTab === 'chat'
                                      ? selectedDocuments.length
                                      : documents.length}
                                  </Text>
                                </View>
                              )}
                            </View>
                            {activeTab === 'chat' && primaryAgent === 'checkpoint' && (
                              <View className="relative items-center justify-center">
                                <Button
                                  onPress={() => setCheckpointsDrawerVisible(true)}
                                  variant="ghost"
                                  size="icon"
                                  className="items-center justify-center">
                                  <Icon as={Clock} size={20} className="text-foreground" />
                                </Button>
                                {selectedCheckpoints.length > 0 && (
                                  <View className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 py-0.5">
                                    <Text className="text-center text-[10px] font-semibold text-primary-foreground">
                                      {selectedCheckpoints.length}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Tabs */}
                  <View className="flex-row border-b border-border px-4">
                    <Pressable
                      onPress={() => setActiveTab('chat')}
                      className={`flex-1 items-center py-3 ${activeTab === 'chat' ? 'border-b-2 border-primary' : ''}`}>
                      <Icon
                        as={MessageSquare}
                        size={20}
                        className={activeTab === 'chat' ? 'text-primary' : 'text-muted-foreground'}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setActiveTab('timeline')}
                      className={`flex-1 items-center py-3 ${activeTab === 'timeline' ? 'border-b-2 border-primary' : ''}`}>
                      <Icon
                        as={Clock}
                        size={20}
                        className={
                          activeTab === 'timeline' ? 'text-primary' : 'text-muted-foreground'
                        }
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setActiveTab('details')}
                      className={`flex-1 items-center py-3 ${activeTab === 'details' ? 'border-b-2 border-primary' : ''}`}>
                      <Icon
                        as={FileText}
                        size={20}
                        className={
                          activeTab === 'details' ? 'text-primary' : 'text-muted-foreground'
                        }
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setActiveTab('providers')}
                      className={`flex-1 items-center py-3 ${activeTab === 'providers' ? 'border-b-2 border-primary' : ''}`}
                      accessibilityLabel="Saved service providers">
                      <View className="relative items-center justify-center">
                        <Icon
                          as={Users}
                          size={20}
                          className={
                            activeTab === 'providers' ? 'text-primary' : 'text-muted-foreground'
                          }
                        />
                        {savedProviders.length > 0 && (
                          <View className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-primary px-1 py-0.5">
                            <Text className="text-center text-[9px] font-semibold text-primary-foreground">
                              {savedProviders.length > 99 ? '99+' : savedProviders.length}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </View>

                  {/* Selected Context Display (Documents + Checkpoints) */}
                  {activeTab === 'chat' &&
                    (selectedDocuments.length > 0 || selectedCheckpoints.length > 0) && (
                      <View className="border-b border-border bg-secondary/50 px-3 py-1.5">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View className="flex-row items-center gap-1.5">
                            {selectedDocuments.length > 0 && (
                              <>
                                <View className="mr-1 flex-row items-center gap-1">
                                  <Icon as={FileText} size={12} className="text-muted-foreground" />
                                  <Text className="text-xs font-medium text-muted-foreground">
                                    {selectedDocuments.length}
                                  </Text>
                                </View>
                                {selectedDocuments.map((doc: Document) => (
                                  <Pressable
                                    key={doc.id}
                                    onPress={() => toggleDocumentSelection(doc)}
                                    className="flex-row items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5">
                                    <Text
                                      className="max-w-24 text-xs text-foreground"
                                      numberOfLines={1}>
                                      {doc.name}
                                    </Text>
                                    <Icon as={X} size={12} className="text-muted-foreground" />
                                  </Pressable>
                                ))}
                              </>
                            )}
                            {selectedCheckpoints.length > 0 && (
                              <>
                                {selectedDocuments.length > 0 && (
                                  <View className="h-4 w-px bg-border" />
                                )}
                                <View className="mr-1 flex-row items-center gap-1">
                                  <Icon as={Camera} size={12} className="text-muted-foreground" />
                                  <Text className="text-xs font-medium text-muted-foreground">
                                    {selectedCheckpoints.length}
                                  </Text>
                                </View>
                                {selectedCheckpoints.map((checkpoint: Checkpoint) => (
                                  <Pressable
                                    key={checkpoint.id}
                                    onPress={() => toggleCheckpointSelection(checkpoint)}
                                    className="flex-row items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5">
                                    <Text
                                      className="max-w-24 text-xs text-foreground"
                                      numberOfLines={1}>
                                      {checkpoint.name || 'Checkpoint'}
                                    </Text>
                                    <Icon as={X} size={12} className="text-muted-foreground" />
                                  </Pressable>
                                ))}
                              </>
                            )}
                            <Pressable
                              onPress={() => {
                                setHasManuallyInteracted(true);
                                setSelectedDocuments([]);
                                setSelectedCheckpoints([]);
                              }}
                              className="ml-1 rounded-full bg-background px-2 py-0.5">
                              <Text className="text-xs text-muted-foreground">Clear All</Text>
                            </Pressable>
                          </View>
                        </ScrollView>
                      </View>
                    )}

                  {/* Main Content Area */}
                  {activeTab === 'chat' ? (
                    <MessagesProvider sessionId={selectedSessionId}>
                      <PropertyChatTab
                        sessionId={selectedSessionId}
                        userId={user?.uid || ''}
                        fileAttachment={fileAttachment}
                        onAttachmentPress={() => {}}
                        onRemoveAttachment={removeFileAttachment}
                        primaryAgent={primaryAgent}
                        onPrimaryAgentChange={setPrimaryAgent}
                        selectedOptionalAgents={selectedOptionalAgents}
                        onToggleOptionalAgent={toggleOptionalAgent}
                        selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
                        onToggleCheckpointOptionalAgent={toggleCheckpointOptionalAgent}
                        isSending={isSending}
                        onStop={handleStop}
                        attachmentOptionsVisible={false}
                        onCloseAttachmentOptions={() => {}}
                        onTakePhoto={handleTakePhoto}
                        onRecordVideo={handleRecordVideo}
                        onSelectFromLibrary={handleSelectFromLibrary}
                        onSelectFiles={handleSelectFiles}
        searchLocation={searchLocation}
        onSearchLocationChange={setSearchLocation}
                        propertyAddress={property?.address}
                        onSend={handleGiftedChatSend}
                      />
                    </MessagesProvider>
                  ) : activeTab === 'timeline' ? (
                    <PropertyCheckpointsTab
                      isCreateModalVisible={isCreateCheckpointModalVisible}
                      setIsCreateModalVisible={setIsCreateCheckpointModalVisible}
                      setActiveTab={setActiveTab}
                    />
                  ) : activeTab === 'providers' ? (
                    <PropertySavedProvidersTab />
                  ) : (
                    <ScrollView className="flex-1 bg-light-background-alt px-4 py-4">
                      <PropertyDetailsTab property={property} />
                    </ScrollView>
                  )}

                  {/* Error Alert Dialog */}
                  <AlertDialogWrapper
                    open={errorAlertOpen}
                    onOpenChange={setErrorAlertOpen}
                    title="Error"
                    description={errorMessage}
                  />

                  {/* Camera Modal for Video Recording */}
                  <CameraModal
                    visible={cameraModalVisible}
                    onClose={() => setCameraModalVisible(false)}
                    onVideoRecorded={handleVideoRecorded}
                  />
                </SafeAreaView>
              }>
              {/* Sessions Drawer Content */}
              <SessionsDrawerContent
                propertyId={id}
                propertyName={property.name}
                onClose={() => setSessionsDrawerVisible(false)}
                onSessionPress={(session: Session) => {
                  setSelectedSessionId(session.id);
                  setActiveTab('chat');
                  setSessionsDrawerVisible(false);
                }}
                onCreateSession={() => {
                  setActiveTab('chat');
                  setSessionsDrawerVisible(false);
                }}
              />
            </PushDrawer>
          }>
          {/* Documents Drawer Content */}
          <DocumentsDrawerContent
            documents={documents}
            selectedDocuments={selectedDocuments}
            activeTab={activeTab}
            onClose={() => setDocumentsDrawerVisible(false)}
            onToggleDocument={toggleDocumentSelection}
          />
        </PushDrawer>
      }>
      {/* Checkpoints Drawer Content */}
      <CheckpointsDrawerContent
        checkpoints={checkpoints}
        selectedCheckpoints={selectedCheckpoints}
        activeTab={activeTab}
        onClose={() => setCheckpointsDrawerVisible(false)}
        onToggleCheckpoint={toggleCheckpointSelection}
      />
    </PushDrawer>
  );
}
