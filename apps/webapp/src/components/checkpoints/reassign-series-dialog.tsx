'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { Checkpoint } from '@/lib/types';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import {
  formatSeriesReassignTargetDescription,
  getDefaultSeriesReassignTargetId,
  getMergeSeriesGuidance,
  listSeriesReassignTargets,
} from '@/lib/checkpoint-series-grouping';
import { useToast } from '@/hooks/use-toast';

type ReassignSeriesDialogProps = {
  checkpoint: Checkpoint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const NEW_SERIES_VALUE = '__new__';

export function ReassignSeriesDialog({
  checkpoint,
  open,
  onOpenChange,
}: ReassignSeriesDialogProps) {
  const { checkpoints, reassignCheckpointSeries } = useCheckpoint();
  const { toast } = useToast();
  const [target, setTarget] = useState<string>(NEW_SERIES_VALUE);
  const [newLocation, setNewLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const existingTargets = useMemo(
    () => (checkpoint ? listSeriesReassignTargets(checkpoints, checkpoint) : []),
    [checkpoints, checkpoint]
  );

  const guidance = useMemo(
    () => getMergeSeriesGuidance(existingTargets),
    [existingTargets]
  );

  useEffect(() => {
    if (!open || !checkpoint) {
      return;
    }
    const defaultTarget = getDefaultSeriesReassignTargetId(existingTargets);
    setTarget(defaultTarget ?? NEW_SERIES_VALUE);
    setNewLocation(checkpoint.location || '');
  }, [open, checkpoint, existingTargets]);

  if (!checkpoint) {
    return null;
  }

  const canReassign = checkpoint.isLatestInSeries !== false;

  const resolveLocation = (): string => {
    if (target === NEW_SERIES_VALUE) {
      return newLocation.trim();
    }
    const match = existingTargets.find((item) => item.seriesId === target);
    return (match?.location || '').trim();
  };

  const handleSave = async () => {
    const location = resolveLocation();
    if (!location) {
      toast({
        title: 'Location required',
        description: 'Choose an existing monitoring point or enter a location name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const assignment = await reassignCheckpointSeries(checkpoint.id, location);
      toast({
        title: 'Captures merged',
        description: `This photo is now v${assignment.revisionNumber} in ${location}.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not merge',
        description:
          error instanceof Error
            ? error.message
            : 'Only the latest capture in a series can be moved.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge capture</DialogTitle>
          <DialogDescription>
            Moving: <span className="font-medium text-foreground">{checkpoint.name}</span>
          </DialogDescription>
        </DialogHeader>

        {!canReassign ? (
          <p className="text-sm text-muted-foreground">
            Only the latest capture in a series can be moved. Open a newer capture in
            this group to merge, or delete newer captures first.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {guidance}
            </p>

            {existingTargets.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="series-target">Merge into</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger id="series-target">
                    <SelectValue placeholder="Select monitoring point" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingTargets.map((item) => (
                      <SelectItem key={item.seriesId} value={item.seriesId}>
                        <span className="flex items-center gap-2">
                          <span>
                            {item.label} ({formatSeriesReassignTargetDescription(item)})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_SERIES_VALUE}>New monitoring point…</SelectItem>
                  </SelectContent>
                </Select>
                {existingTargets.find((item) => item.seriesId === target)
                  ?.isSuggestedMatch ? (
                  <Badge variant="secondary" className="font-normal">
                    Suggested — same location as this capture
                  </Badge>
                ) : null}
              </div>
            ) : null}

            {target === NEW_SERIES_VALUE || existingTargets.length === 0 ? (
              <div className="space-y-2">
                <Label htmlFor="series-location">Monitoring point name</Label>
                <Input
                  id="series-location"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Kitchen, Vehicle - Exterior"
                  disabled={isSaving}
                />
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canReassign || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
