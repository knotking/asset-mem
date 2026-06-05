import * as React from 'react';
import {
  View,
  Modal,
  Platform,
  Pressable,
  FlatList,
  Image,
  TextInput,
  ListRenderItem,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  X,
  Camera,
  Images,
  Video,
  FileText,
  Clock,
  Upload,
  Search,
} from 'lucide-react-native';
import type { Checkpoint, Document, PendingContextItem, PrimaryAgent } from '@homeapp/common/types';
import type { ToggleSelectionResult } from '@homeapp/common/contexts/chat-context-context';
import {
  getCheckpointThumbnail,
  isCheckpointReady,
  isDocumentReady,
  isDocumentImage,
} from '@homeapp/common/lib/chat-context-readiness';
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
  ADD_CONTEXT_TIMELINE_DOCS_MODE_NOTE,
  ADD_CONTEXT_SEARCH_PLACEHOLDER_TIMELINE,
  ADD_CONTEXT_SEARCH_PLACEHOLDER_DOCUMENTS,
  CONTEXT_SELECTION_CHECKPOINT_LIMIT,
  CONTEXT_SELECTION_DOCUMENT_LIMIT,
  type AddContextCaptureAction,
  getAddContextLaunchingLabel,
  isTimelineCaptureAction,
} from '@homeapp/common/lib/chat-context-labels';
import {
  ADD_CONTEXT_DOC_BROWSE_PAGE_SIZE,
  MAX_SELECTED_CHECKPOINTS,
  MAX_SELECTED_DOCUMENTS,
} from '@homeapp/common/lib/chat-context-limits';
import {
  filterCheckpointsBySearch,
  filterDocumentsBySearch,
  getRecentReadyCheckpoints,
  getRecentReadyDocuments,
} from '@homeapp/common/lib/chat-context-picker';

type ContextTab = 'timeline' | 'documents';

type Props = {
  visible: boolean;
  onClose: () => void;
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
};

type RowItem =
  | { key: string; kind: 'section'; title: string }
  | { key: string; kind: 'note'; message: string }
  | { key: string; kind: 'pending'; item: PendingContextItem }
  | { key: string; kind: 'checkpoint'; checkpoint: Checkpoint }
  | { key: string; kind: 'document'; document: Document }
  | { key: string; kind: 'load-checkpoints' }
  | { key: string; kind: 'load-documents' }
  | { key: string; kind: 'empty'; message: string };

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
    <Pressable
      onPress={onPress}
      className={`mb-2 flex-row items-center gap-3 rounded-xl border p-3 ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}>
      <View className="h-14 w-14 overflow-hidden rounded-lg bg-muted">
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon as={FallbackIcon} size={22} className="text-muted-foreground" />
          </View>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        className={`h-5 w-5 rounded-full border-2 ${
          selected ? 'border-primary bg-primary' : 'border-muted-foreground'
        }`}
      />
    </Pressable>
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
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-lg px-3 py-2 ${
        active ? 'bg-background' : ''
      }`}>
      <Text
        className={`text-sm font-medium ${
          active ? 'text-foreground' : 'text-muted-foreground'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}

function pendingItemLabel(item: PendingContextItem): string {
  if (item.kind === 'checkpoint') return 'Analyzing checkpoint…';
  if (item.status === 'uploading') return 'Uploading document…';
  if (item.status === 'analyzing') return 'Analyzing document…';
  return 'Indexing for chat…';
}

export function AddContextSheet({
  visible,
  onClose,
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
}: Props) {
  const defaultTab: ContextTab = primaryAgent === 'checkpoint' ? 'timeline' : 'documents';
  const [activeTab, setActiveTab] = React.useState<ContextTab>(defaultTab);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [docVisibleCount, setDocVisibleCount] = React.useState(
    ADD_CONTEXT_DOC_BROWSE_PAGE_SIZE
  );
  const [limitHint, setLimitHint] = React.useState<string | null>(null);
  const [launchingAction, setLaunchingAction] = React.useState<AddContextCaptureAction | null>(
    null
  );
  const launchingRef = React.useRef(false);
  const insets = useSafeAreaInsets();

  /** Instant feedback; close only after a successful pick/capture. */
  const closeAfterAction = React.useCallback(
    (actionKind: AddContextCaptureAction, action: () => Promise<boolean> | boolean) => {
      if (launchingRef.current) return;
      launchingRef.current = true;
      setLaunchingAction(actionKind);
      void (async () => {
        try {
          const shouldClose = await action();
          if (shouldClose) onClose();
        } finally {
          launchingRef.current = false;
          setLaunchingAction(null);
        }
      })();
    },
    [onClose]
  );

  const pendingCheckpointCount = pendingContext.filter((p) => p.kind === 'checkpoint').length;
  const pendingDocumentCount = pendingContext.filter((p) => p.kind === 'document').length;
  const hasPendingContext = pendingContext.length > 0;
  const pendingCheckpoints = pendingContext.filter((p) => p.kind === 'checkpoint');
  const pendingDocuments = pendingContext.filter((p) => p.kind === 'document');
  const pendingSummaryParts: string[] = [];
  if (pendingCheckpointCount > 0) {
    pendingSummaryParts.push(
      `${pendingCheckpointCount} checkpoint${pendingCheckpointCount === 1 ? '' : 's'}`
    );
  }
  if (pendingDocumentCount > 0) {
    pendingSummaryParts.push(
      `${pendingDocumentCount} document${pendingDocumentCount === 1 ? '' : 's'}`
    );
  }

  React.useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setDocVisibleCount(ADD_CONTEXT_DOC_BROWSE_PAGE_SIZE);
      setLimitHint(null);
      launchingRef.current = false;
      setLaunchingAction(null);
    } else {
      setActiveTab(defaultTab);
    }
  }, [visible, defaultTab]);

  const isCheckpointMode = primaryAgent === 'checkpoint';
  const trimmedSearch = searchQuery.trim();
  const hasSearch = trimmedSearch.length > 0;

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

  const listItems = React.useMemo((): RowItem[] => {
    const items: RowItem[] = [];

    if (activeTab === 'timeline') {
      if (!isCheckpointMode) {
        items.push({ key: 'note-docs-mode', kind: 'note', message: ADD_CONTEXT_TIMELINE_DOCS_MODE_NOTE });
        return items;
      }
      if (pendingCheckpoints.length > 0) {
        items.push({ key: 'sec-pending-cp', kind: 'section', title: 'Pending' });
        for (const pending of pendingCheckpoints) {
          items.push({ key: `pending-cp-${pending.id}`, kind: 'pending', item: pending });
        }
      }
      const showRecentCheckpoints = recentCheckpoints.length > 0 && !hasSearch;
      if (showRecentCheckpoints) {
        items.push({ key: 'sec-recent-cp', kind: 'section', title: ADD_CONTEXT_RECENT_LABEL });
        for (const cp of recentCheckpoints) {
          items.push({ key: `recent-cp-${cp.id}`, kind: 'checkpoint', checkpoint: cp });
        }
      }
      if (shouldShowAddContextLibrarySectionHeader(hasSearch, showRecentCheckpoints)) {
        items.push({
          key: 'sec-library-cp',
          kind: 'section',
          title: getAddContextLibrarySectionLabel('timeline', hasSearch),
        });
      }
      if (browseCheckpoints.length === 0) {
        const noCheckpointMessage = hasSearch
          ? 'No matching checkpoints.'
          : showRecentCheckpoints
            ? 'No checkpoints beyond Recent.'
            : 'No checkpoints available yet. Capture one above.';
        items.push({
          key: 'empty-cp',
          kind: 'empty',
          message: noCheckpointMessage,
        });
      } else {
        for (const cp of browseCheckpoints) {
          items.push({ key: `cp-${cp.id}`, kind: 'checkpoint', checkpoint: cp });
        }
      }
      if (hasMoreCheckpoints) {
        items.push({ key: 'load-cp', kind: 'load-checkpoints' });
      }
      return items;
    }

    const showRecentDocuments = recentDocuments.length > 0 && !hasSearch;
    if (pendingDocuments.length > 0) {
      items.push({ key: 'sec-pending-doc', kind: 'section', title: 'Pending' });
      for (const pending of pendingDocuments) {
        items.push({ key: `pending-doc-${pending.id}`, kind: 'pending', item: pending });
      }
    }
    if (showRecentDocuments) {
      items.push({ key: 'sec-recent-doc', kind: 'section', title: ADD_CONTEXT_RECENT_LABEL });
      for (const doc of recentDocuments) {
        items.push({ key: `recent-doc-${doc.id}`, kind: 'document', document: doc });
      }
    }
    if (shouldShowAddContextLibrarySectionHeader(hasSearch, showRecentDocuments)) {
      items.push({
        key: 'sec-library-doc',
        kind: 'section',
        title: getAddContextLibrarySectionLabel('documents', hasSearch),
      });
    }
    if (visibleBrowseDocuments.length === 0) {
      const noDocumentMessage = hasSearch
        ? 'No matching documents.'
        : showRecentDocuments
          ? 'No documents beyond Recent.'
          : 'No documents available yet. Upload one above.';
      items.push({
        key: 'empty-doc',
        kind: 'empty',
        message: noDocumentMessage,
      });
    } else {
      for (const doc of visibleBrowseDocuments) {
        items.push({ key: `doc-${doc.id}`, kind: 'document', document: doc });
      }
    }
    if (hasMoreDocs) {
      items.push({ key: 'load-doc', kind: 'load-documents' });
    }

    return items;
  }, [
    activeTab,
    isCheckpointMode,
    recentCheckpoints,
    pendingCheckpoints,
    browseCheckpoints,
    hasMoreCheckpoints,
    pendingDocuments,
    recentDocuments,
    visibleBrowseDocuments,
    hasMoreDocs,
    hasSearch,
  ]);

  const handleToggleCheckpoint = React.useCallback(
    (cp: Checkpoint) => {
      if (!isCheckpointReady(cp)) return;
      const result = onToggleCheckpoint(cp);
      if (result === 'limit_reached') {
        setLimitHint(CONTEXT_SELECTION_CHECKPOINT_LIMIT(MAX_SELECTED_CHECKPOINTS));
      } else {
        setLimitHint(null);
      }
    },
    [onToggleCheckpoint]
  );

  const handleToggleDocument = React.useCallback(
    (doc: Document) => {
      if (!isDocumentReady(doc)) return;
      const result = onToggleDocument(doc);
      if (result === 'limit_reached') {
        setLimitHint(CONTEXT_SELECTION_DOCUMENT_LIMIT(MAX_SELECTED_DOCUMENTS));
      } else {
        setLimitHint(null);
      }
    },
    [onToggleDocument]
  );

  const renderItem: ListRenderItem<RowItem> = React.useCallback(
    ({ item }) => {
      if (item.kind === 'section') {
        return (
          <Text className="mb-2 mt-3 text-sm font-semibold text-foreground">{item.title}</Text>
        );
      }
      if (item.kind === 'note') {
        return (
          <Text className="mb-3 mt-2 text-sm leading-5 text-muted-foreground">{item.message}</Text>
        );
      }
      if (item.kind === 'pending') {
        const pending = item.item;
        return (
          <View className="mb-2 flex-row items-center gap-3 rounded-xl border border-dashed border-border bg-muted/50 p-3">
            <View className="h-14 w-14 overflow-hidden rounded-lg bg-muted">
              {pending.localPreviewUri ? (
                <Image source={{ uri: pending.localPreviewUri }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Icon as={pending.kind === 'checkpoint' ? Clock : FileText} size={22} className="text-muted-foreground" />
                </View>
              )}
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                {pending.label || (pending.kind === 'checkpoint' ? 'Checkpoint' : 'Document')}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {pendingItemLabel(pending)}
              </Text>
            </View>
            <ActivityIndicator size="small" />
          </View>
        );
      }
      if (item.kind === 'empty') {
        return <Text className="mb-2 text-sm text-muted-foreground">{item.message}</Text>;
      }
      if (item.kind === 'load-checkpoints') {
        return (
          <Button
            variant="outline"
            className="mb-3 mt-1"
            onPress={onLoadMoreCheckpoints}
            disabled={isLoadingMoreCheckpoints}>
            <Text className="text-foreground">
              {isLoadingMoreCheckpoints ? 'Loading…' : 'Load more checkpoints'}
            </Text>
          </Button>
        );
      }
      if (item.kind === 'load-documents') {
        return (
          <Button
            variant="outline"
            className="mb-3 mt-1"
            onPress={() =>
              setDocVisibleCount((n) => n + ADD_CONTEXT_DOC_BROWSE_PAGE_SIZE)
            }>
            <Text className="text-foreground">Load more documents</Text>
          </Button>
        );
      }
      if (item.kind === 'checkpoint') {
        const cp = item.checkpoint;
        return (
          <ContextListRow
            thumbnailUri={getCheckpointThumbnail(cp)}
            fallbackIcon={Clock}
            title={cp.name || 'Checkpoint'}
            subtitle={cp.location}
            selected={selectedCheckpointIds.has(cp.id!)}
            onPress={() => handleToggleCheckpoint(cp)}
          />
        );
      }
      const doc = item.document;
      return (
        <ContextListRow
          thumbnailUri={isDocumentImage(doc) ? doc.url : undefined}
          fallbackIcon={FileText}
          title={doc.name}
          subtitle={doc.documentType}
          selected={selectedDocumentIds.has(doc.id)}
          onPress={() => handleToggleDocument(doc)}
        />
      );
    },
    [
      selectedCheckpointIds,
      selectedDocumentIds,
      handleToggleCheckpoint,
      handleToggleDocument,
      onLoadMoreCheckpoints,
      isLoadingMoreCheckpoints,
    ]
  );

  const modeHint = isCheckpointMode
    ? ADD_CONTEXT_MODE_HINT_CHECKPOINT
    : ADD_CONTEXT_MODE_HINT_DOCS;

  const searchPlaceholder =
    activeTab === 'timeline'
      ? ADD_CONTEXT_SEARCH_PLACEHOLDER_TIMELINE
      : ADD_CONTEXT_SEARCH_PLACEHOLDER_DOCUMENTS;

  const captureBusy = launchingAction !== null;

  const renderCaptureButton = (
    actionKind: AddContextCaptureAction,
    label: string,
    IconComponent: typeof Camera,
    handler: () => Promise<boolean> | boolean
  ) => {
    const isActive = launchingAction === actionKind;
    return (
      <Pressable
        key={actionKind}
        onPress={() => closeAfterAction(actionKind, handler)}
        disabled={captureBusy}
        className={`min-w-[30%] flex-1 items-center rounded-xl border border-border p-3 ${
          captureBusy ? 'opacity-60' : 'bg-secondary/40'
        } ${isActive ? 'border-primary bg-primary/10' : ''}`}>
        <View className="mb-1 h-[22px] w-[22px] items-center justify-center">
          {isActive ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon as={IconComponent} size={22} className="text-primary" />
          )}
        </View>
        <Text className="text-center text-xs font-medium">{label}</Text>
      </Pressable>
    );
  };

  const captureActions =
    activeTab === 'timeline' ? (
      <View className="mb-2">
        <View className="mb-2 flex-row flex-wrap gap-2">
          {renderCaptureButton('camera', 'Capture', Camera, onCapturePhoto)}
          {renderCaptureButton('gallery', 'Gallery', Images, onPickGallery)}
          {renderCaptureButton('video', 'Video', Video, onCaptureVideo)}
        </View>
        {launchingAction && isTimelineCaptureAction(launchingAction) ? (
          <Text className="mb-2 text-center text-xs text-muted-foreground">
            {getAddContextLaunchingLabel(launchingAction)}
          </Text>
        ) : null}
      </View>
    ) : (
      <View className="mb-2">
        <Pressable
          onPress={() => closeAfterAction('upload', onUploadDocument)}
          disabled={captureBusy}
          className={`mb-2 flex-row items-center justify-center gap-2 rounded-xl border border-border p-3 ${
            captureBusy ? 'opacity-60' : 'bg-secondary/40'
          } ${launchingAction === 'upload' ? 'border-primary bg-primary/10' : ''}`}>
          <View className="h-[22px] w-[22px] items-center justify-center">
            {launchingAction === 'upload' ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon as={Upload} size={22} className="text-primary" />
            )}
          </View>
          <Text className="text-sm font-medium text-foreground">Upload document</Text>
        </Pressable>
        {launchingAction === 'upload' ? (
          <Text className="mb-2 text-center text-xs text-muted-foreground">
            {getAddContextLaunchingLabel('upload')}
          </Text>
        ) : null}
      </View>
    );

  const searchBar = (
    <View className="mb-2 flex-row items-center rounded-xl border border-border bg-muted/40 px-3">
      <Icon as={Search} size={18} className="text-muted-foreground" />
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={searchPlaceholder}
        placeholderTextColor="#9ca3af"
        className="ml-2 flex-1 py-2.5 text-sm text-foreground"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {searchQuery.length > 0 ? (
        <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
          <Icon as={X} size={16} className="text-muted-foreground" />
        </Pressable>
      ) : null}
    </View>
  );

  const listHeader = (
    <View>
      <View style={{ minHeight: launchingAction ? 96 : 76 }}>{captureActions}</View>
      {hasPendingContext ? (
        <View className="mb-2 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2">
          <Text className="text-xs text-muted-foreground">
            Processing {pendingContext.length} item{pendingContext.length === 1 ? '' : 's'}
            {pendingSummaryParts.length > 0 ? ` (${pendingSummaryParts.join(', ')})` : ''}. They
            will auto-select when ready.
          </Text>
        </View>
      ) : null}
      {searchBar}
      {limitHint ? (
        <Text className="mb-2 text-xs text-destructive">{limitHint}</Text>
      ) : null}
    </View>
  );

  const pinnedHeader = (
    <View className="px-4 pb-2">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-foreground">{ADD_CONTEXT_TITLE}</Text>
        <Button variant="ghost" size="icon" onPress={onClose}>
          <Icon as={X} size={20} className="text-foreground" />
        </Button>
      </View>

      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          {ADD_CONTEXT_SELECTED_SUMMARY(
            selectedCheckpointCount,
            selectedDocumentCount,
            MAX_SELECTED_CHECKPOINTS,
            MAX_SELECTED_DOCUMENTS
          )}
        </Text>
        {(selectedCheckpointCount > 0 || selectedDocumentCount > 0) && (
          <Pressable onPress={onClearSelection}>
            <Text className="text-xs text-primary">Clear</Text>
          </Pressable>
        )}
      </View>

      <View className="mb-2 flex-row rounded-lg bg-muted p-1">
        <TabButton
          label={ADD_CONTEXT_TAB_TIMELINE}
          active={activeTab === 'timeline'}
          onPress={() => {
            setActiveTab('timeline');
            setSearchQuery('');
            setLimitHint(null);
          }}
        />
        <TabButton
          label={ADD_CONTEXT_TAB_DOCUMENTS}
          active={activeTab === 'documents'}
          onPress={() => {
            setActiveTab('documents');
            setSearchQuery('');
            setLimitHint(null);
          }}
        />
      </View>

      <Text className="text-xs leading-4 text-muted-foreground">{modeHint}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View
        className="flex-1 bg-background"
        style={{
          paddingTop: Platform.OS === 'ios' ? 12 : Math.max(insets.top, 12),
        }}>
        {pinnedHeader}
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={16}
          windowSize={7}
          onEndReached={() => {
            if (
              activeTab === 'timeline' &&
              isCheckpointMode &&
              hasMoreCheckpoints &&
              !isLoadingMoreCheckpoints
            ) {
              onLoadMoreCheckpoints();
            }
          }}
          onEndReachedThreshold={0.4}
        />
      </View>
    </Modal>
  );
}
