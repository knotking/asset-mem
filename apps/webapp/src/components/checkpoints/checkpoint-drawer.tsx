'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Camera, X, MapPin, Calendar } from 'lucide-react';
import type { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CheckpointDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkpoints: Checkpoint[];
  selectedCheckpoints: Checkpoint[];
  onToggleCheckpoint: (checkpoint: Checkpoint) => void;
}

export function CheckpointDrawer({
  open,
  onOpenChange,
  checkpoints,
  selectedCheckpoints,
  onToggleCheckpoint,
}: CheckpointDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Select Checkpoints</SheetTitle>
          <SheetDescription>
            {selectedCheckpoints.length} selected for chat context
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {checkpoints.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                No checkpoints available for this property.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create checkpoints to track property condition over time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-sm text-muted-foreground">
                  Select checkpoints to provide context for your chat conversation. The AI will use
                  these checkpoints to answer questions about property condition, changes, and
                  history.
                </p>
              </div>
              <div className="space-y-3">
                {checkpoints.map((checkpoint) => {
                  const isSelected = selectedCheckpoints.some((cp) => cp.id === checkpoint.id);
                  const date = checkpoint.createdAt?.toDate
                    ? checkpoint.createdAt.toDate()
                    : checkpoint.createdAt instanceof Date
                      ? checkpoint.createdAt
                      : new Date();

                  return (
                    <button
                      key={checkpoint.id}
                      onClick={() => onToggleCheckpoint(checkpoint)}
                      className={cn(
                        'w-full rounded-lg border p-4 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-secondary'
                          : 'border-border bg-card hover:bg-muted'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                            isSelected ? 'bg-primary' : 'bg-secondary'
                          )}
                        >
                          <Camera
                            className={cn(
                              'h-5 w-5',
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {checkpoint.name || 'Untitled Checkpoint'}
                          </p>
                          {checkpoint.location && (
                            <div className="mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-xs text-muted-foreground truncate">
                                {checkpoint.location}
                              </p>
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {format(date, 'MMM d, yyyy')}
                            </p>
                          </div>
                          {checkpoint.aiAnalysis?.summary && (
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                              {checkpoint.aiAnalysis.summary}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                            <X className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

