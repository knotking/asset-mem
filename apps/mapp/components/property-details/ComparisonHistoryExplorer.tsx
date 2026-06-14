import * as React from 'react';
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { X, History } from 'lucide-react-native';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type ComparisonExplorerEntry,
  type ComparisonExplorerScope,
  fetchComparisonExplorerEntries,
  formatExplorerEntryTitle,
  formatMatchReasonLabel,
  getSeriesCapturesForCheckpoint,
} from '@homeapp/common/lib/checkpoint-comparisons';
import type { Checkpoint } from '@homeapp/common/types';
import type { Firestore } from 'firebase/firestore';
import { cn } from '@/lib/utils';

type ComparisonHistoryExplorerProps = {
  visible: boolean;
  db: Firestore;
  userId: string;
  propertyId: string;
  checkpoint: Checkpoint;
  checkpoints: Checkpoint[];
  onClose: () => void;
  initialEntryId?: string | null;
};

function ComparisonDetailPanel({ entry }: { entry: ComparisonExplorerEntry }) {
  const before = entry.beforeCheckpoint;
  const after = entry.afterCheckpoint;
  const diff = entry.record;
  const beforeImage = before?.media?.[0]?.url;
  const afterImage = after?.media?.[0]?.url;
  const { width } = useWindowDimensions();
  const imageWidth = Math.min(width - 48, 400);

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-2">
        <Badge variant="outline">
          <Text className="text-xs">{diff.source === 'manual' ? 'Manual' : 'Auto'}</Text>
        </Badge>
        {formatMatchReasonLabel(diff.matchReason) ? (
          <Badge variant="secondary">
            <Text className="text-xs">{formatMatchReasonLabel(diff.matchReason)}</Text>
          </Badge>
        ) : null}
        <Badge variant="secondary">
          <Text className="text-xs">{Math.round((diff.similarityScore ?? 0) * 100)}% similar</Text>
        </Badge>
      </View>

      {diff.summary ? (
        <Text className="text-sm leading-5 text-muted-foreground">{diff.summary}</Text>
      ) : null}

      <View className="gap-3">
        {[beforeImage, afterImage].map((url, idx) => (
          <View key={idx} className="gap-1">
            <Text className="text-xs font-medium text-muted-foreground">
              {idx === 0 ? 'Before' : 'After'} · {idx === 0 ? before?.name : after?.name}
            </Text>
            {url ? (
              <Image
                source={{ uri: url }}
                style={{ width: imageWidth, height: imageWidth * 0.65, borderRadius: 8 }}
                contentFit="contain"
              />
            ) : (
              <View className="h-40 items-center justify-center rounded-lg bg-muted">
                <Text className="text-sm text-muted-foreground">No image</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {diff.semanticChanges?.length ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Detected changes</Text>
          {diff.semanticChanges.map((change, idx) => (
            <Text key={idx} className="text-sm text-muted-foreground">
              • {change}
            </Text>
          ))}
        </View>
      ) : null}

      {diff.regions?.length ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Change regions</Text>
          {diff.regions.map((region, idx) => (
            <View key={region.id ?? idx} className="rounded-lg border border-border p-3">
              <Text className="text-xs text-muted-foreground">
                {region.severity} · {region.changeType}
              </Text>
              <Text className="mt-1 text-sm text-foreground">{region.description}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ComparisonHistoryExplorer({
  visible,
  db,
  userId,
  propertyId,
  checkpoint,
  checkpoints,
  onClose,
  initialEntryId,
}: ComparisonHistoryExplorerProps) {
  const insets = useSafeAreaInsets();
  const [scope, setScope] = React.useState<ComparisonExplorerScope>('series');
  const [loading, setLoading] = React.useState(false);
  const [entries, setEntries] = React.useState<ComparisonExplorerEntry[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const seriesCaptureCount = React.useMemo(
    () => getSeriesCapturesForCheckpoint(checkpoint, checkpoints).length,
    [checkpoint, checkpoints]
  );
  const showScopeToggle = seriesCaptureCount > 1;

  React.useEffect(() => {
    if (!visible) return;
    setScope(seriesCaptureCount > 1 ? 'series' : 'capture');
  }, [visible, seriesCaptureCount]);

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const loaded = await fetchComparisonExplorerEntries(
          db,
          userId,
          propertyId,
          checkpoint,
          checkpoints,
          scope
        );
        if (!cancelled) {
          setEntries(loaded);
          const preferred =
            initialEntryId && loaded.some((e) => e.id === initialEntryId)
              ? initialEntryId
              : loaded[0]?.id ?? null;
          setSelectedId(preferred);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, db, userId, propertyId, checkpoint, checkpoints, scope, initialEntryId]);

  const selected = entries.find((e) => e.id === selectedId) ?? entries[0];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="flex-1 flex-row items-center gap-2">
            <Icon as={History} size={20} className="text-foreground" />
            <Text className="text-lg font-semibold text-foreground">Comparison history</Text>
          </View>
          <Button onPress={onClose} variant="ghost" size="icon">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>

        {showScopeToggle ? (
          <View className="flex-row gap-2 border-b border-border px-4 py-2">
            <Button
              size="sm"
              variant={scope === 'capture' ? 'default' : 'outline'}
              onPress={() => setScope('capture')}>
              <Text>This capture</Text>
            </Button>
            <Button
              size="sm"
              variant={scope === 'series' ? 'default' : 'outline'}
              onPress={() => setScope('series')}>
              <Text>Full series ({seriesCaptureCount})</Text>
            </Button>
          </View>
        ) : null}

        {loading ? (
          <View className="flex-1 items-center justify-center gap-2">
            <ActivityIndicator />
            <Text className="text-sm text-muted-foreground">Loading comparisons…</Text>
          </View>
        ) : entries.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-sm text-muted-foreground">
              No stored comparisons yet.
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="border-b border-border"
              contentContainerStyle={{ padding: 12, gap: 8 }}>
              {entries.map((entry) => {
                const isActive = entry.id === selected?.id;
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => setSelectedId(entry.id)}
                    className={cn(
                      'min-w-[200px] rounded-lg border px-3 py-2',
                      isActive ? 'border-primary bg-primary/10' : 'border-border bg-card'
                    )}>
                    <Text className="text-sm font-medium text-foreground">
                      {formatExplorerEntryTitle(entry, checkpoint.visualDiff?.id)}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
                      {entry.record.summary ?? 'Comparison'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="p-4">
              {selected ? (
                <>
                  {selected.completedAtMs > 0 ? (
                    <Text className="mb-3 text-xs text-muted-foreground">
                      {format(new Date(selected.completedAtMs), 'PPp')}
                    </Text>
                  ) : null}
                  <ComparisonDetailPanel entry={selected} />
                </>
              ) : null}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
