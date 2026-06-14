import * as React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { History } from 'lucide-react-native';
import {
  fetchCheckpointComparisons,
  formatComparisonHistoryLabel,
  mergeComparisonHistory,
} from '@homeapp/common/lib/checkpoint-comparisons';
import type { Checkpoint, CheckpointComparisonRecord } from '@homeapp/common/types';
import type { Firestore } from 'firebase/firestore';

type ComparisonHistoryListProps = {
  db: Firestore;
  userId: string;
  propertyId: string;
  checkpoint: Checkpoint;
  checkpoints: Checkpoint[];
  onSelect: (record: CheckpointComparisonRecord) => void;
  onOpenExplorer?: () => void;
};

export function ComparisonHistoryList({
  db,
  userId,
  propertyId,
  checkpoint,
  checkpoints,
  onSelect,
  onOpenExplorer,
}: ComparisonHistoryListProps) {
  const [loading, setLoading] = React.useState(true);
  const [records, setRecords] = React.useState<CheckpointComparisonRecord[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const fetched = await fetchCheckpointComparisons(
          db,
          userId,
          propertyId,
          checkpoint.id
        );
        if (!cancelled) {
          setRecords(mergeComparisonHistory(fetched, checkpoint.visualDiff));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, propertyId, checkpoint.id, checkpoint.visualDiff]);

  if (loading) {
    return (
      <View className="flex-row items-center gap-2 py-2">
        <ActivityIndicator size="small" />
        <Text className="text-sm text-muted-foreground">Loading comparison history…</Text>
      </View>
    );
  }

  if (records.length === 0) {
    return null;
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon as={History} size={16} className="text-muted-foreground" />
          <Text className="text-sm font-semibold text-foreground">Comparison history</Text>
          <Badge variant="secondary">
            <Text className="text-xs">{records.length}</Text>
          </Badge>
        </View>
        {onOpenExplorer ? (
          <Button variant="link" size="sm" onPress={onOpenExplorer}>
            <Text>Browse all</Text>
          </Button>
        ) : null}
      </View>
      {records.map((record) => {
        const partner = checkpoints.find((c) => c.id === record.comparedWithCheckpointId);
        const isLatest = checkpoint.visualDiff?.id === record.id;
        return (
          <Pressable
            key={record.id}
            className="rounded-lg border border-border bg-card px-3 py-2"
            onPress={() => onSelect(record)}>
            <Text className="text-sm font-medium text-foreground">
              {formatComparisonHistoryLabel(record, partner?.name)}
              {isLatest ? ' · Latest' : ''}
            </Text>
            {record.summary ? (
              <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
                {record.summary}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
