'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BeforeAfterSlider } from './before-after-slider';
import { Loader2, History } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { db } from '@/lib/firebase';
import {
  type ComparisonExplorerEntry,
  type ComparisonExplorerScope,
  fetchComparisonExplorerEntries,
  formatExplorerEntryTitle,
  formatMatchReasonLabel,
  getSeriesCapturesForCheckpoint,
} from '@/lib/checkpoint-comparisons';
import type { Checkpoint } from '@/lib/types';
import { cn } from '@/lib/utils';

type ComparisonHistoryExplorerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkpoint: Checkpoint;
  checkpoints: Checkpoint[];
  initialEntryId?: string | null;
};

function entryCompletedDate(entry: ComparisonExplorerEntry): Date {
  return entry.completedAtMs > 0 ? new Date(entry.completedAtMs) : new Date();
}

function ComparisonDetailPanel({ entry }: { entry: ComparisonExplorerEntry }) {
  const before = entry.beforeCheckpoint;
  const after = entry.afterCheckpoint;
  const diff = entry.record;
  const beforeImage = before?.media?.[0]?.url;
  const afterImage = after?.media?.[0]?.url;
  const matchLabel = formatMatchReasonLabel(diff.matchReason);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{diff.source === 'manual' ? 'Manual' : 'Auto'}</Badge>
        {matchLabel ? <Badge variant="secondary">{matchLabel}</Badge> : null}
        <Badge variant="secondary">
          {Math.round((diff.similarityScore ?? 0) * 100)}% similar
        </Badge>
        {entry.completedAtMs > 0 ? (
          <span className="text-xs text-muted-foreground">
            {format(entryCompletedDate(entry), 'PPp')}
          </span>
        ) : null}
      </div>

      {diff.summary ? (
        <p className="text-sm text-muted-foreground">{diff.summary}</p>
      ) : null}

      <Tabs defaultValue="slider" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="slider">Slider</TabsTrigger>
          <TabsTrigger value="side-by-side">Side by side</TabsTrigger>
        </TabsList>
        <TabsContent value="slider" className="mt-3">
          {beforeImage && afterImage ? (
            <BeforeAfterSlider
              beforeImage={beforeImage}
              afterImage={afterImage}
              beforeLabel={before?.name ?? 'Before'}
              afterLabel={after?.name ?? 'After'}
            />
          ) : (
            <div className="rounded-lg border bg-muted p-8 text-center text-sm text-muted-foreground">
              No images for this comparison
            </div>
          )}
        </TabsContent>
        <TabsContent value="side-by-side" className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {[beforeImage, afterImage].map((url, idx) => (
              <div key={idx} className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                {url ? (
                  <Image src={url} alt={idx === 0 ? 'Before' : 'After'} fill className="object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No image
                  </div>
                )}
                <div className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
                  {idx === 0 ? 'Before' : 'After'}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {diff.semanticChanges?.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Detected changes</h4>
          <ul className="space-y-1.5 text-sm">
            {diff.semanticChanges.map((change, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {diff.regions?.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Change regions</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {diff.regions.map((region, idx) => (
              <div key={region.id ?? idx} className="rounded-lg border p-3 text-sm">
                <div className="mb-1 flex flex-wrap gap-1">
                  <Badge
                    variant={
                      region.severity === 'critical' || region.severity === 'major'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {region.severity}
                  </Badge>
                  <Badge variant="outline">{region.changeType}</Badge>
                </div>
                <p>{region.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ComparisonHistoryExplorer({
  open,
  onOpenChange,
  checkpoint,
  checkpoints,
  initialEntryId,
}: ComparisonHistoryExplorerProps) {
  const { user } = useAuth();
  const { property } = useProperty();
  const [scope, setScope] = useState<ComparisonExplorerScope>('series');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<ComparisonExplorerEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const seriesCaptureCount = useMemo(
    () => getSeriesCapturesForCheckpoint(checkpoint, checkpoints).length,
    [checkpoint, checkpoints]
  );
  const showScopeToggle = seriesCaptureCount > 1;

  useEffect(() => {
    if (!open) return;
    setScope(seriesCaptureCount > 1 ? 'series' : 'capture');
  }, [open, seriesCaptureCount]);

  useEffect(() => {
    if (!open || !user || !property) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const loaded = await fetchComparisonExplorerEntries(
          db,
          user.uid,
          property.id,
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
  }, [open, user, property, checkpoint, checkpoints, scope, initialEntryId]);

  const selected = entries.find((e) => e.id === selectedId) ?? entries[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Comparison history
          </DialogTitle>
          <DialogDescription>
            Browse stored before/after diffs for this capture
            {showScopeToggle ? ' or the full monitoring series' : ''}.
          </DialogDescription>
          {showScopeToggle ? (
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                variant={scope === 'capture' ? 'default' : 'outline'}
                onClick={() => setScope('capture')}
              >
                This capture
              </Button>
              <Button
                type="button"
                size="sm"
                variant={scope === 'series' ? 'default' : 'outline'}
                onClick={() => setScope('series')}
              >
                Full series ({seriesCaptureCount})
              </Button>
            </div>
          ) : null}
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading comparisons…
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No stored comparisons yet. Run a compare from checkpoint detail or wait for auto-compare
            after analysis.
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(220px,280px)_1fr]">
            <div className="max-h-[50vh] overflow-y-auto border-b lg:max-h-none lg:border-b-0 lg:border-r">
              <ul className="p-2">
                {entries.map((entry) => {
                  const isActive = entry.id === selected?.id;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={cn(
                          'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                          isActive ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
                        )}
                        onClick={() => setSelectedId(entry.id)}
                      >
                        <p className="text-sm font-medium">
                          {formatExplorerEntryTitle(entry, checkpoint.visualDiff?.id)}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {entry.record.summary ||
                            formatMatchReasonLabel(entry.record.matchReason) ||
                            'Comparison'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {entry.record.source === 'manual' ? 'Manual' : 'Auto'}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {Math.round((entry.record.similarityScore ?? 0) * 100)}%
                          </Badge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden p-4 lg:max-h-[calc(92vh-8rem)]">
              {selected ? (
                <ComparisonDetailPanel entry={selected} />
              ) : (
                <p className="text-sm text-muted-foreground">Select a comparison</p>
              )}
            </div>
          </div>
        )}

        <Separator />
        <div className="flex justify-end px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
