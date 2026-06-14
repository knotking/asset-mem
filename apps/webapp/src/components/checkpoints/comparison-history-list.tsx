'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, History } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { db } from '@/lib/firebase';
import {
  fetchCheckpointComparisons,
  formatComparisonHistoryLabel,
  mergeComparisonHistory,
} from '@/lib/checkpoint-comparisons';
import type { Checkpoint, CheckpointComparisonRecord } from '@/lib/types';

type ComparisonHistoryListProps = {
  checkpoint: Checkpoint;
  checkpoints: Checkpoint[];
  onSelect: (record: CheckpointComparisonRecord) => void;
  onOpenExplorer?: () => void;
};

export function ComparisonHistoryList({
  checkpoint,
  checkpoints,
  onSelect,
  onOpenExplorer,
}: ComparisonHistoryListProps) {
  const { user } = useAuth();
  const { property } = useProperty();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CheckpointComparisonRecord[]>([]);

  useEffect(() => {
    if (!user || !property) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const fetched = await fetchCheckpointComparisons(
          db,
          user.uid,
          property.id,
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
  }, [user, property, checkpoint.id, checkpoint.visualDiff]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading comparison history…
      </div>
    );
  }

  if (records.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-muted-foreground" />
          Comparison history
          <Badge variant="secondary">{records.length}</Badge>
        </div>
        {onOpenExplorer ? (
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={onOpenExplorer}>
            Browse all
          </Button>
        ) : null}
      </div>
      <ul className="space-y-1">
        {records.map((record) => {
          const partner = checkpoints.find(
            (c) => c.id === record.comparedWithCheckpointId
          );
          const isLatest = checkpoint.visualDiff?.id === record.id;
          return (
            <li key={record.id}>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start px-2 py-1.5 text-left"
                onClick={() => onSelect(record)}
              >
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm">
                    {formatComparisonHistoryLabel(record, partner?.name)}
                    {isLatest ? (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Latest
                      </Badge>
                    ) : null}
                  </span>
                  {record.summary ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {record.summary}
                    </span>
                  ) : null}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
