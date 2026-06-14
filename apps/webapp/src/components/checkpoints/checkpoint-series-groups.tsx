'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { CheckpointCard } from './checkpoint-card';
import type { CheckpointSeriesGroup } from '@/lib/checkpoint-series-grouping';
import type { Checkpoint } from '@/lib/types';
import { format } from 'date-fns';
import { checkpointEffectiveDate } from '@/lib/report-resolve';

interface CheckpointSeriesGroupsProps {
  groups: CheckpointSeriesGroup[];
  selectionMode: boolean;
  selectedCheckpoints: Set<string>;
  isCheckpointDeletingOverlay: (cp: Checkpoint) => boolean;
  isResourceDeletionFailed: (cp: Checkpoint) => boolean;
  onCheckpointClick: (checkpoint: Checkpoint) => void;
  onSelect: (checkpointId: string, selected: boolean) => void;
  onRetryDelete: (checkpoint: Checkpoint) => void;
}

export function CheckpointSeriesGroups({
  groups,
  selectionMode,
  selectedCheckpoints,
  isCheckpointDeletingOverlay,
  isResourceDeletionFailed,
  onCheckpointClick,
  onSelect,
  onRetryDelete,
}: CheckpointSeriesGroupsProps) {
  const multiCaptureGroups = groups.filter((g) => g.captureCount > 1);
  const singleCaptureGroups = groups.filter((g) => g.captureCount === 1);

  const renderCard = (checkpoint: Checkpoint, compact?: boolean) => (
    <CheckpointCard
      key={checkpoint.id}
      checkpoint={checkpoint}
      compact={compact}
      selected={selectedCheckpoints.has(checkpoint.id)}
      selectionMode={selectionMode}
      isDeleting={isCheckpointDeletingOverlay(checkpoint)}
      isDeleteFailed={isResourceDeletionFailed(checkpoint)}
      onRetryDelete={() => onRetryDelete(checkpoint)}
      onClick={() => !selectionMode && onCheckpointClick(checkpoint)}
      onSelect={(selected) => onSelect(checkpoint.id, selected)}
    />
  );

  return (
    <div className="space-y-3">
      {multiCaptureGroups.length > 0 && (
        <Accordion
          type="multiple"
          defaultValue={multiCaptureGroups.map((g) => g.seriesId)}
          className="space-y-2"
        >
          {multiCaptureGroups.map((group) => {
            const latestDate = checkpointEffectiveDate(group.latestCapture);
            return (
              <AccordionItem
                key={group.seriesId}
                value={group.seriesId}
                className="rounded-lg border px-3"
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-2 pr-2 text-left">
                    <div>
                      <p className="font-semibold text-foreground">{group.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.captureCount} captures
                        {latestDate
                          ? ` · latest ${format(latestDate, 'MMM d, yyyy')}`
                          : ''}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {group.captureCount} versions
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3 pt-0">
                  {group.captures.map((capture) => renderCard(capture, true))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {singleCaptureGroups.map((group) => renderCard(group.latestCapture))}
    </div>
  );
}
