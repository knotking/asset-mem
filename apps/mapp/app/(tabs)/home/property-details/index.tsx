import { Text } from '@/components/ui/text';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
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
  Clock,
  Users,
  BookOpen,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePropertiesList } from '@homeapp/common/contexts/properties-list-context';
import { useProperty } from '@homeapp/common/contexts/property-context';
import { useSession } from '@homeapp/common/contexts/session-context';
import { MessagesProvider } from '@homeapp/common/contexts/messages-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { serverTimestamp, doc, updateDoc } from 'firebase/firestore';
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
import { PropertyDetailsTab } from '@/components/property-details/PropertyDetailsTab';
import { PropertySavedProvidersTab } from '@/components/property-details/PropertySavedProvidersTab';
import { parsePropertyScreenTab, type PropertyScreenTab } from '@/components/property-details/property-screen-tab';
import { PropertyChatWithContext } from '@/components/chat/PropertyChatWithContext';
import { useSavedServiceProviders } from '@homeapp/common/contexts/saved-service-providers-context';
import { SessionsDrawerContent } from '@/components/property-details/SessionsDrawerContent';
import { DocumentsDrawerContent } from '@/components/property-details/DocumentsDrawerContent';
import { AlertDialogWrapper } from '@/components/property-details/AlertDialogWrapper';
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
  const onboardingHandledRef = React.useRef(false);

  React.useEffect(() => {
    if (
      fromOnboardingChecklist !== '1' ||
      activeTab !== 'chat' ||
      onboardingHandledRef.current
    ) {
      return;
    }
    onboardingHandledRef.current = true;
    // Strip the route param immediately so Timeline/Details/Providers tab taps are
    // not delayed by a Firestore write finishing later.
    router.setParams({
      [ONBOARDING_CHAT_OPEN_PARAM]: undefined,
    } as Record<string, string | undefined>);
    void updatePreferences({ onboardingChatOpened: true });
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
  const [errorAlertOpen, setErrorAlertOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [searchLocation, setSearchLocation] = React.useState<SearchLocationInput | undefined>(
    undefined
  );

  // Refs
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Custom hooks
  const { selectedSessionId, setSelectedSessionId } = useSessionSelection(propertyId ?? '', sessionId);

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
      userId: user?.uid ?? '',
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
        setIsSending={setIsSending}
        errorAlertOpen={errorAlertOpen}
        setErrorAlertOpen={setErrorAlertOpen}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
        toggleOptionalAgent={toggleOptionalAgent}
        handleStop={handleStop}
        searchLocation={searchLocation}
        setSearchLocation={setSearchLocation}
        router={router}
        user={user}
        db={db}
        storage={storage}
        abortControllerRef={abortControllerRef}
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
  setIsSending,
  errorAlertOpen,
  setErrorAlertOpen,
  errorMessage,
  setErrorMessage,
  toggleOptionalAgent,
  handleStop,
  searchLocation,
  setSearchLocation,
  router,
  user,
  db,
  storage,
  abortControllerRef,
}: any) {
  const { checkpoints } = useCheckpoint();
  const { savedProviders } = useSavedServiceProviders();

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
                        <Button
                          onPress={() => router.navigate('/(tabs)/settings/faq')}
                          variant="ghost"
                          size="icon"
                          accessibilityLabel="FAQ & guides">
                          <Icon as={BookOpen} size={20} className="text-foreground" />
                        </Button>
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
                        {activeTab === 'details' && (
                          <View className="relative items-center justify-center">
                            <Button
                              onPress={() => setDocumentsDrawerVisible(true)}
                              variant="ghost"
                              size="icon"
                              className="items-center justify-center">
                              <Icon as={File} size={20} className="text-foreground" />
                            </Button>
                            {documents.length > 0 && (
                              <View className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 py-0.5">
                                <Text className="text-center text-[10px] font-semibold text-primary-foreground">
                                  {documents.length}
                                </Text>
                              </View>
                            )}
                          </View>
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

                  {/* Main Content Area */}
                  {activeTab === 'chat' ? (
                    <MessagesProvider sessionId={selectedSessionId}>
                      <PropertyChatWithContext
                        sessionId={selectedSessionId}
                        userId={user?.uid || ''}
                        propertyId={id!}
                        propertyAddress={property?.address}
                        primaryAgent={primaryAgent}
                        onPrimaryAgentChange={setPrimaryAgent}
                        selectedOptionalAgents={selectedOptionalAgents}
                        onToggleOptionalAgent={toggleOptionalAgent}
                        selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
                        onToggleCheckpointOptionalAgent={toggleCheckpointOptionalAgent}
                        isSending={isSending}
                        setIsSending={setIsSending}
                        onStop={handleStop}
                        searchLocation={searchLocation}
                        onSearchLocationChange={setSearchLocation}
                        db={db}
                        storage={storage}
                        abortControllerRef={abortControllerRef}
                        onError={(msg) => {
                          setErrorMessage(msg);
                          setErrorAlertOpen(true);
                        }}
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
