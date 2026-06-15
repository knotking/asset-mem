'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { AnalysisResults } from './analysis-results';
import { Calendar, MapPin, Tag, Trash2, ArrowRightLeft, Loader2, AlertCircle, Pencil, Check, X, Layers } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useToast } from '@/hooks/use-toast';
import { checkpointDeleteConfirm } from '@/lib/deletion';
import { getCheckpointAnalysisFailureMessage } from '@/lib/plan-limit-errors';
import { createLogger } from '@/lib/logger';
import { CheckpointComparisonDialog } from './checkpoint-comparison-dialog';
import { ComparisonHistoryList } from './comparison-history-list';
import { ComparisonHistoryExplorer } from './comparison-history-explorer';
import { ReassignSeriesDialog } from './reassign-series-dialog';
import {
  findPreviousCaptureInList,
  formatCaptureRevisionLabel,
  hasSuggestedMergeTargets,
} from '@/lib/checkpoint-series-grouping';
import type { CheckpointComparisonRecord } from '@/lib/types';
import { comparisonRecordToVisualDiff } from '@/lib/checkpoint-comparisons';

const checkpointLog = createLogger('checkpoint');

export function CheckpointDetailDialog() {
  const {
    selectedCheckpoint,
    setSelectedCheckpoint,
    deleteCheckpoint,
    updateCheckpoint,
    checkpoints,
  } = useCheckpoint();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [historyVisualDiff, setHistoryVisualDiff] = useState<CheckpointComparisonRecord | null>(
    null
  );
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerInitialEntryId, setExplorerInitialEntryId] = useState<string | null>(null);
  const [isReassignOpen, setIsReassignOpen] = useState(false);

  // Reset edit mode when dialog closes
  useEffect(() => {
    if (!selectedCheckpoint) {
      setIsEditing(false);
      setEditedName('');
      setIsDeleteDialogOpen(false);
    }
  }, [selectedCheckpoint]);

  if (!selectedCheckpoint) return null;

  const checkpoint = selectedCheckpoint;
  const createdAt = checkpoint.createdAt?.toDate
    ? checkpoint.createdAt.toDate()
    : checkpoint.createdAt instanceof Date
      ? checkpoint.createdAt
      : new Date();

  const hasAnalysis = !!checkpoint.aiAnalysis;
  const analysis = checkpoint.aiAnalysis;
  const isAnalyzing = checkpoint.analysisStatus === 'processing' || checkpoint.analysisStatus === 'pending';
  const analysisFailed = checkpoint.analysisStatus === 'failed';
  const analysisFailureMessage = analysisFailed
    ? getCheckpointAnalysisFailureMessage(checkpoint)
    : '';
  const isAnalyzed = checkpoint.analysisStatus === 'completed' && hasAnalysis;
  const comparisonBefore = checkpoint.visualDiff?.comparedWithCheckpointId
    ? checkpoints.find((c) => c.id === checkpoint.visualDiff?.comparedWithCheckpointId)
    : undefined;
  const previousInSeries = findPreviousCaptureInList(checkpoints, checkpoint);
  const comparisonPartner = comparisonBefore ?? previousInSeries;
  const revisionLabel = formatCaptureRevisionLabel(checkpoint);
  const showMergeAction = hasSuggestedMergeTargets(checkpoints, checkpoint);

  const handleStartEdit = () => {
    setEditedName(checkpoint.name);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName('');
  };

  const handleSaveEdit = async () => {
    const trimmedName = editedName.trim();
    
    if (!trimmedName) {
      toast({
        title: 'Invalid Name',
        description: 'Checkpoint name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    if (trimmedName === checkpoint.name) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await updateCheckpoint(checkpoint.id, { name: trimmedName });
      toast({
        title: 'Checkpoint Renamed',
        description: 'The checkpoint name has been updated successfully.',
      });
      setIsEditing(false);
    } catch (error) {
      checkpointLog.error('checkpoint.rename.failed', undefined, error);
      toast({
        title: 'Rename Failed',
        description: 'Failed to rename checkpoint. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = (event: React.MouseEvent) => {
    event.preventDefault();
    const checkpointId = checkpoint.id;
    setIsDeleteDialogOpen(false);
    setSelectedCheckpoint(null);
    void (async () => {
      try {
        await deleteCheckpoint(checkpointId);
        toast({
          title: 'Checkpoint Deleted',
          description: 'The checkpoint has been successfully deleted.',
        });
      } catch (error) {
        checkpointLog.error('checkpoint.delete.failed', undefined, error);
        toast({
          title: 'Deletion Failed',
          description: 'Failed to delete checkpoint. Please try again.',
          variant: 'destructive',
        });
      } finally {
      }
    })();
  };

  const handleClose = () => {
    setSelectedCheckpoint(null);
  };

  return (
    <>
    <Dialog open={!!selectedCheckpoint} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter checkpoint name"
                  disabled={isSaving}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  className="text-xl"
                />
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editedName.trim()}
                    title="Save"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <DialogTitle className="text-xl truncate">{checkpoint.name}</DialogTitle>
                {revisionLabel ? (
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {revisionLabel}
                  </Badge>
                ) : null}
              </div>
              {isAnalyzed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleStartEdit}
                  title="Rename checkpoint"
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <DialogDescription>
            Checkpoint details and AI analysis results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Media Gallery */}
          {checkpoint.media && checkpoint.media.length > 0 && (
            <div className="relative">
              {checkpoint.media.length === 1 ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={checkpoint.media[0].url}
                    alt={checkpoint.name}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <Carousel className="w-full">
                  <CarouselContent>
                    {checkpoint.media.map((media, idx) => (
                      <CarouselItem key={media.id}>
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                          <Image
                            src={media.url}
                            alt={`${checkpoint.name} - Image ${idx + 1}`}
                            fill
                            className="object-contain"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">{format(createdAt, 'PPpp')}</span>
            </div>

            {checkpoint.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium">{checkpoint.location}</span>
              </div>
            )}

            {isAnalyzed && (
              <div className="flex items-center gap-2 text-sm sm:col-span-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Monitoring point:</span>
                <span className="font-medium">
                  {checkpoint.location || checkpoint.name}
                  {revisionLabel ? ` · ${revisionLabel}` : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-7"
                  onClick={() => setIsReassignOpen(true)}
                >
                  {showMergeAction ? 'Merge…' : 'Change'}
                </Button>
              </div>
            )}

            {checkpoint.tags && checkpoint.tags.length > 0 && (
              <div className="flex items-start gap-2 text-sm sm:col-span-2">
                <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">Tags:</span>
                <div className="flex flex-wrap gap-1">
                  {checkpoint.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {checkpoint.description && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 text-sm font-semibold">Description</h3>
                <p className="text-sm text-muted-foreground">{checkpoint.description}</p>
              </div>
            </>
          )}

          {/* Auto-detected Asset Info */}
          {checkpoint.detectedAsset && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 text-sm font-semibold">Auto-detected Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Detected as:</span>
                    <Badge variant="secondary">{checkpoint.detectedAsset}</Badge>
                    {checkpoint.assetConfidence && (
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(checkpoint.assetConfidence * 100)}% confidence)
                      </span>
                    )}
                  </div>
                  {checkpoint.assetFeatures && checkpoint.assetFeatures.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Key features: </span>
                      <span>{checkpoint.assetFeatures.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Analysis Status */}
          {isAnalyzing && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Analysis in Progress</p>
                <p className="text-sm text-blue-700">AI is analyzing this checkpoint...</p>
              </div>
            </div>
          )}

          {analysisFailed && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Analysis unavailable</p>
                <p className="text-sm text-red-700">{analysisFailureMessage}</p>
              </div>
            </div>
          )}

          {/* AI Analysis Results */}
          {hasAnalysis && analysis && (
            <>
              <Separator />
              <AnalysisResults analysis={analysis} />
            </>
          )}

          {/* Visual Diff / series comparison */}
          {(checkpoint.visualDiff || previousInSeries) && (
            <>
              <Separator />
              <div className="flex items-center gap-3 rounded-lg border bg-muted p-4">
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">
                    {checkpoint.visualDiff ? 'Comparison Available' : 'Compare with previous'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {comparisonPartner
                      ? checkpoint.visualDiff
                        ? `Compared with ${comparisonPartner.name}`
                        : `Previous capture: ${comparisonPartner.name}`
                      : 'This checkpoint has been compared with a previous one'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!comparisonPartner}
                  onClick={() => {
                    setHistoryVisualDiff(null);
                    setIsComparisonOpen(true);
                  }}
                >
                  {checkpoint.visualDiff ? 'View comparison' : 'Compare'}
                </Button>
              </div>
              <ComparisonHistoryList
                checkpoint={checkpoint}
                checkpoints={checkpoints}
                onSelect={(record) => {
                  setHistoryVisualDiff(record);
                  setIsComparisonOpen(true);
                }}
                onOpenExplorer={() => {
                  setExplorerInitialEntryId(null);
                  setIsExplorerOpen(true);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  setExplorerInitialEntryId(null);
                  setIsExplorerOpen(true);
                }}
              >
                Open comparison explorer
              </Button>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete checkpoint?</AlertDialogTitle>
          <AlertDialogDescription>
            {checkpointDeleteConfirm(checkpoint.name)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            className="bg-destructive hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {isComparisonOpen && comparisonPartner && (
      <CheckpointComparisonDialog
        open={isComparisonOpen}
        onOpenChange={(open) => {
          setIsComparisonOpen(open);
          if (!open) setHistoryVisualDiff(null);
        }}
        checkpoint1={
          historyVisualDiff?.comparedWithCheckpointId
            ? checkpoints.find((c) => c.id === historyVisualDiff.comparedWithCheckpointId) ??
              comparisonPartner
            : comparisonPartner
        }
        checkpoint2={checkpoint}
        initialVisualDiff={
          historyVisualDiff ? comparisonRecordToVisualDiff(historyVisualDiff) : undefined
        }
      />
    )}

    <ComparisonHistoryExplorer
      open={isExplorerOpen}
      onOpenChange={setIsExplorerOpen}
      checkpoint={checkpoint}
      checkpoints={checkpoints}
      initialEntryId={explorerInitialEntryId}
    />

    <ReassignSeriesDialog
      checkpoint={checkpoint}
      open={isReassignOpen}
      onOpenChange={setIsReassignOpen}
    />
    </>
  );
}

