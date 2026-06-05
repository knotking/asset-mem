import * as React from 'react';
import { View, Pressable, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { X, FileText, Clock } from 'lucide-react-native';
import type { Checkpoint, Document, PendingContextItem } from '@homeapp/common/types';
import {
  getCheckpointThumbnail,
  isDocumentImage,
} from '@homeapp/common/lib/chat-context-readiness';
import {
  ASK_WHEN_READY_HINT,
  ASK_WHEN_READY_LABEL,
  PENDING_CHECKPOINT_LABEL,
  PENDING_DOCUMENT_ANALYZE_LABEL,
  PENDING_DOCUMENT_INDEX_LABEL,
  PENDING_DOCUMENT_UPLOAD_LABEL,
} from '@homeapp/common/lib/chat-context-labels';
import { ADD_CONTEXT_VISIBLE_CHIP_COUNT } from '@homeapp/common/lib/chat-context-limits';

type Props = {
  pendingContext: PendingContextItem[];
  readySelectedCheckpoints: Checkpoint[];
  readySelectedDocuments: Document[];
  queuedSend: { text: string } | null;
  onToggleCheckpoint: (cp: Checkpoint) => void;
  onToggleDocument: (doc: Document) => void;
  onRemovePending: (id: string) => void;
  onClearReady: () => void;
  onCancelQueuedSend?: () => void;
};

function pendingLabel(item: PendingContextItem): string {
  if (item.kind === 'checkpoint') return PENDING_CHECKPOINT_LABEL;
  if (item.status === 'uploading') return PENDING_DOCUMENT_UPLOAD_LABEL;
  if (item.status === 'analyzing') return PENDING_DOCUMENT_ANALYZE_LABEL;
  return PENDING_DOCUMENT_INDEX_LABEL;
}

type PreviewChip =
  | { kind: 'checkpoint'; item: Checkpoint }
  | { kind: 'document'; item: Document };

export function ChatContextChipStrip({
  pendingContext,
  readySelectedCheckpoints,
  readySelectedDocuments,
  queuedSend,
  onToggleCheckpoint,
  onToggleDocument,
  onRemovePending,
  onClearReady,
  onCancelQueuedSend,
}: Props) {
  const readyPreview = React.useMemo((): PreviewChip[] => {
    const chips: PreviewChip[] = [];
    for (const cp of readySelectedCheckpoints) {
      chips.push({ kind: 'checkpoint', item: cp });
    }
    for (const doc of readySelectedDocuments) {
      chips.push({ kind: 'document', item: doc });
    }
    return chips;
  }, [readySelectedCheckpoints, readySelectedDocuments]);

  const visibleReady = readyPreview.slice(0, ADD_CONTEXT_VISIBLE_CHIP_COUNT);
  const hiddenReadyCount = Math.max(0, readyPreview.length - visibleReady.length);

  const hasContent =
    pendingContext.length > 0 || readyPreview.length > 0 || queuedSend;

  if (!hasContent) return null;

  return (
    <View className="mb-2 gap-2">
      {queuedSend ? (
        <View className="flex-row items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <View className="mr-2 flex-1">
            <Text className="text-xs font-semibold text-primary">{ASK_WHEN_READY_LABEL}</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {queuedSend.text}
            </Text>
            <Text className="text-[10px] text-muted-foreground">{ASK_WHEN_READY_HINT}</Text>
          </View>
          {onCancelQueuedSend ? (
            <Pressable onPress={onCancelQueuedSend} hitSlop={8}>
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row items-center gap-2">
          {pendingContext.map((item) => (
            <View
              key={item.id}
              className="flex-row items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/50 py-1 pl-1 pr-2">
              {item.localPreviewUri ? (
                <Image source={{ uri: item.localPreviewUri }} className="h-8 w-8 rounded-md" />
              ) : (
                <View className="h-8 w-8 items-center justify-center rounded-md bg-secondary">
                  <Icon
                    as={item.kind === 'checkpoint' ? Clock : FileText}
                    size={14}
                    className="text-muted-foreground"
                  />
                </View>
              )}
              <ActivityIndicator size="small" />
              <Text className="max-w-28 text-xs text-muted-foreground" numberOfLines={1}>
                {item.label || pendingLabel(item)}
              </Text>
              <Pressable onPress={() => onRemovePending(item.id)} hitSlop={6}>
                <Icon as={X} size={12} className="text-muted-foreground" />
              </Pressable>
            </View>
          ))}

          {visibleReady.map((chip) => {
            if (chip.kind === 'checkpoint') {
              const cp = chip.item;
              const thumb = getCheckpointThumbnail(cp);
              return (
                <Pressable
                  key={`cp-${cp.id}`}
                  onPress={() => onToggleCheckpoint(cp)}
                  className="flex-row items-center gap-1.5 rounded-lg border border-primary bg-primary/10 py-1 pl-1 pr-2">
                  {thumb ? (
                    <Image source={{ uri: thumb }} className="h-8 w-8 rounded-md" />
                  ) : (
                    <View className="h-8 w-8 items-center justify-center rounded-md bg-secondary">
                      <Icon as={Clock} size={14} className="text-primary" />
                    </View>
                  )}
                  <Text className="max-w-24 text-xs text-foreground" numberOfLines={1}>
                    {cp.name || 'Checkpoint'}
                  </Text>
                  <Icon as={X} size={12} className="text-muted-foreground" />
                </Pressable>
              );
            }
            const doc = chip.item;
            return (
              <Pressable
                key={`doc-${doc.id}`}
                onPress={() => onToggleDocument(doc)}
                className="flex-row items-center gap-1.5 rounded-lg border border-primary bg-primary/10 py-1 pl-1 pr-2">
                {isDocumentImage(doc) && doc.url ? (
                  <Image source={{ uri: doc.url }} className="h-8 w-8 rounded-md" />
                ) : (
                  <View className="h-8 w-8 items-center justify-center rounded-md bg-secondary">
                    <Icon as={FileText} size={14} className="text-primary" />
                  </View>
                )}
                <Text className="max-w-24 text-xs text-foreground" numberOfLines={1}>
                  {doc.name}
                </Text>
                <Icon as={X} size={12} className="text-muted-foreground" />
              </Pressable>
            );
          })}

          {hiddenReadyCount > 0 ? (
            <View className="rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1">
              <Text className="text-xs font-medium text-primary">+{hiddenReadyCount} more</Text>
            </View>
          ) : null}

          {readyPreview.length > 0 && (
            <Pressable onPress={onClearReady} className="rounded-lg bg-secondary px-2 py-1">
              <Text className="text-xs text-muted-foreground">Clear</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
