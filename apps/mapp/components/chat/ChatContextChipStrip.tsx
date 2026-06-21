import * as React from 'react';
import { View, Pressable, Image, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { X, FileText, Clock, Plus, ChevronDown, ClipboardList } from 'lucide-react-native';
import type {
  AnalysisOptionalAgent,
  Checkpoint,
  CheckpointOptionalAgent,
  Document,
  PendingContextItem,
  PrimaryAgent,
  PropertyReport,
} from '@homeapp/common/types';
import {
  getCheckpointThumbnail,
  isDocumentImage,
} from '@homeapp/common/lib/chat-context-readiness';
import {
  ASK_WHEN_READY_HINT,
  ASK_WHEN_READY_LABEL,
} from '@homeapp/common/lib/chat-context-labels';
import { buildCollapsedComposerSummary } from '@homeapp/common/lib/composer-collapse';
import { getRequiredContextEmptyPillLabel } from '@homeapp/common/lib/chat-send-context';
import { cn } from '@/lib/utils';

const PEEK_THUMB_COUNT = 3;

type Props = {
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  pendingContext: PendingContextItem[];
  readySelectedCheckpoints: Checkpoint[];
  readySelectedDocuments: Document[];
  readySelectedReports?: PropertyReport[];
  queuedSend: { text: string } | null;
  onCancelQueuedSend?: () => void;
  /** Summary pill — open add-attachments sheet to review selection. */
  onViewAll?: () => void;
};

type PreviewChip =
  | { kind: 'checkpoint'; item: Checkpoint }
  | { kind: 'document'; item: Document }
  | { kind: 'report'; item: PropertyReport };

type PeekEntry =
  | { key: string; kind: 'pending'; item: PendingContextItem }
  | { key: string; kind: 'ready'; chip: PreviewChip };

function PeekThumbnail({
  entry,
  overlap,
}: {
  entry: PeekEntry;
  overlap?: boolean;
}) {
  const baseClass = cn(
    'h-7 w-7 overflow-hidden rounded-full border-2 border-background',
    overlap ? '-ml-2' : undefined
  );

  if (entry.kind === 'pending') {
    const item = entry.item;
    return (
      <View className={cn(baseClass, 'relative items-center justify-center bg-muted')}>
        {item.localPreviewUri ? (
          <Image source={{ uri: item.localPreviewUri }} className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center bg-secondary">
            <Icon
              as={item.kind === 'checkpoint' ? Clock : FileText}
              size={12}
              className="text-muted-foreground"
            />
          </View>
        )}
        <View className="absolute inset-0 items-center justify-center bg-background/40">
          <ActivityIndicator size="small" />
        </View>
      </View>
    );
  }

  const chip = entry.chip;
  if (chip.kind === 'checkpoint') {
    const thumb = getCheckpointThumbnail(chip.item);
    return (
      <View className={cn(baseClass, 'bg-primary/10')}>
        {thumb ? (
          <Image source={{ uri: thumb }} className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center bg-secondary">
            <Icon as={Clock} size={12} className="text-primary" />
          </View>
        )}
      </View>
    );
  }

  if (chip.kind === 'document') {
    const doc = chip.item;
    return (
      <View className={cn(baseClass, 'bg-primary/10')}>
        {isDocumentImage(doc) && doc.url ? (
          <Image source={{ uri: doc.url }} className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center bg-secondary">
            <Icon as={FileText} size={12} className="text-primary" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className={cn(baseClass, 'items-center justify-center bg-primary/10')}>
      <Icon as={ClipboardList} size={12} className="text-primary" />
    </View>
  );
}

function ContextSummaryPill({
  peekEntries,
  summary,
  onViewAll,
  variant = 'default',
}: {
  peekEntries: PeekEntry[];
  summary: string;
  onViewAll?: () => void;
  variant?: 'default' | 'empty';
}) {
  const isEmpty = variant === 'empty';

  return (
    <Pressable
      onPress={onViewAll}
      accessibilityRole="button"
      accessibilityLabel={
        isEmpty ? `${summary}. Add attachment.` : `${summary}. View all attachments.`
      }
      className={cn(
        'min-w-0 flex-row items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-2.5',
        isEmpty ? 'border-dashed border-muted-foreground/40' : 'border-border'
      )}>
      {isEmpty ? (
        <View className="ml-0.5 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted">
          <Icon as={Plus} size={14} className="text-muted-foreground" />
        </View>
      ) : peekEntries.length > 0 ? (
        <View className="flex-row items-center pl-0.5">
          {peekEntries.map((entry, index) => (
            <PeekThumbnail key={entry.key} entry={entry} overlap={index > 0} />
          ))}
        </View>
      ) : null}
      <Text
        className={cn(
          'min-w-0 flex-1 font-medium',
          isEmpty ? 'text-muted-foreground' : 'text-foreground'
        )}
        style={{ fontSize: 12, lineHeight: 16 }}
        allowFontScaling={false}
        numberOfLines={1}>
        {summary}
      </Text>
      <Icon as={ChevronDown} size={16} className="shrink-0 text-muted-foreground" />
    </Pressable>
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
  const readyPreview = React.useMemo((): PreviewChip[] => {
    const chips: PreviewChip[] = [];
    for (const cp of readySelectedCheckpoints) {
      chips.push({ kind: 'checkpoint', item: cp });
    }
    for (const doc of readySelectedDocuments) {
      chips.push({ kind: 'document', item: doc });
    }
    for (const report of readySelectedReports) {
      chips.push({ kind: 'report', item: report });
    }
    return chips;
  }, [readySelectedCheckpoints, readySelectedDocuments, readySelectedReports]);

  const peekEntries = React.useMemo((): PeekEntry[] => {
    const entries: PeekEntry[] = [];
    for (const item of pendingContext) {
      if (entries.length >= PEEK_THUMB_COUNT) break;
      entries.push({ key: `pending-${item.id}`, kind: 'pending', item });
    }
    for (const chip of readyPreview) {
      if (entries.length >= PEEK_THUMB_COUNT) break;
      const key =
        chip.kind === 'checkpoint'
          ? `cp-${chip.item.id}`
          : chip.kind === 'document'
            ? `doc-${chip.item.id}`
            : `report-${chip.item.id}`;
      entries.push({ key, kind: 'ready', chip });
    }
    return entries;
  }, [pendingContext, readyPreview]);

  const contextSummary = buildCollapsedComposerSummary({
    primaryAgent,
    selectedOptionalAgents,
    selectedCheckpointOptionalAgents,
    readyContextCount: readyPreview.length,
    pendingContextCount: pendingContext.length,
    hasQueuedSend: queuedSend != null,
  });

  const hasAttachmentRow = pendingContext.length > 0 || readyPreview.length > 0;
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
        <View
          className="min-w-0 max-w-full"
          style={{ marginBottom: 4 }}>
          <ContextSummaryPill
            peekEntries={[]}
            summary={emptyPillLabel}
            onViewAll={onViewAll}
            variant="empty"
          />
        </View>
      );
    }
    return null;
  }

  return (
    <View
      className="min-w-0 max-w-full gap-1.5"
      style={{ marginBottom: 4 }}>
      {queuedSend ? (
        <View className="flex-row items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <View className="mr-2 min-w-0 flex-1">
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
      {hasAttachmentRow ? (
        <ContextSummaryPill
          peekEntries={peekEntries}
          summary={contextSummary}
          onViewAll={onViewAll}
        />
      ) : null}
    </View>
  );
}
