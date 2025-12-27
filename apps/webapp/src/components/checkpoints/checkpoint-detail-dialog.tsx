'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { Calendar, MapPin, Trash2, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import type { Checkpoint } from '@homeapp/common/types';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CheckpointDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkpoint: Checkpoint | null;
}

export function CheckpointDetailDialog({
  open,
  onOpenChange,
  checkpoint,
}: CheckpointDetailDialogProps) {
  const { deleteCheckpoint } = useCheckpoint();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!checkpoint) return null;

  const createdDate = checkpoint.createdAt?.toDate
    ? checkpoint.createdAt.toDate()
    : checkpoint.createdAt instanceof Date
      ? checkpoint.createdAt
      : new Date();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCheckpoint(checkpoint.id);
      toast({
        title: 'Checkpoint deleted',
        description: 'The checkpoint has been successfully deleted.',
      });
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      toast({
        title: 'Error deleting checkpoint',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      critical: { className: 'bg-red-100 text-red-800 border-red-200', label: 'Critical' },
      major: { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Major' },
      moderate: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Moderate' },
      minor: { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Minor' },
    };
    const variant = variants[severity] || variants.minor;
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl">{checkpoint.name}</DialogTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{format(createdDate, 'MMM dd, yyyy, hh:mm a')}</span>
                  </div>
                  {checkpoint.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      <span>{checkpoint.location}</span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Description */}
            {checkpoint.description && (
              <div>
                <p className="text-muted-foreground">{checkpoint.description}</p>
              </div>
            )}

            {/* Media Gallery */}
            {checkpoint.media.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {checkpoint.media.map((mediaItem, index) => (
                    <div
                      key={mediaItem.id}
                      className="relative aspect-video overflow-hidden rounded-lg bg-muted"
                    >
                      <Image
                        src={mediaItem.url}
                        alt={`Checkpoint ${index + 1}`}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            {checkpoint.aiAnalysis && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold">AI Analysis</h3>
                    {checkpoint.analysisStatus === 'processing' && (
                      <Badge variant="outline">Analyzing...</Badge>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Summary</h4>
                    <p className="text-sm text-muted-foreground">
                      {checkpoint.aiAnalysis.summary}
                    </p>
                  </div>

                  <Separator />

                  {/* Detected Items */}
                  {checkpoint.aiAnalysis.detectedItems &&
                    checkpoint.aiAnalysis.detectedItems.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Detected Items</h4>
                        <div className="flex flex-wrap gap-2">
                          {checkpoint.aiAnalysis.detectedItems.map((item, index) => (
                            <Badge key={index} variant="secondary">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Conditions */}
                  {checkpoint.aiAnalysis.conditions &&
                    checkpoint.aiAnalysis.conditions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Conditions</h4>
                        <div className="flex flex-wrap gap-2">
                          {checkpoint.aiAnalysis.conditions.map((condition, index) => (
                            <Badge key={index} variant="outline">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Issues */}
                  {checkpoint.aiAnalysis.issues && checkpoint.aiAnalysis.issues.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Issues Detected ({checkpoint.aiAnalysis.issues.length})
                      </h4>
                      <div className="space-y-2">
                        {checkpoint.aiAnalysis.issues.map((issue, index) => {
                          if (typeof issue === 'string') {
                            return (
                              <div
                                key={index}
                                className="p-3 rounded-lg border bg-muted/30 text-sm"
                              >
                                {issue}
                              </div>
                            );
                          }
                          return (
                            <div
                              key={index}
                              className="p-3 rounded-lg border bg-muted/30 flex items-start gap-3"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">{issue.description}</p>
                                {issue.category && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {issue.category}
                                  </p>
                                )}
                              </div>
                              {issue.severity && getSeverityBadge(issue.severity)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Analysis Timestamp */}
                  {checkpoint.aiAnalysis.analyzedAt && (
                    <div className="text-xs text-muted-foreground pt-2">
                      Analyzed{' '}
                      {format(
                        checkpoint.aiAnalysis.analyzedAt.toDate
                          ? checkpoint.aiAnalysis.analyzedAt.toDate()
                          : new Date(checkpoint.aiAnalysis.analyzedAt as any),
                        'MMM dd, yyyy, hh:mm a'
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pending Analysis */}
            {!checkpoint.aiAnalysis && checkpoint.analysisStatus !== 'failed' && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm">
                      {checkpoint.analysisStatus === 'processing'
                        ? 'AI analysis in progress...'
                        : 'Waiting for AI analysis...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Auto-detected Location */}
            {checkpoint.detectedAsset && (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h4 className="text-sm font-medium">Auto-detected Information</h4>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{checkpoint.detectedAsset}</span>
                    {checkpoint.assetConfidence && (
                      <Badge variant="outline" className="text-xs">
                        {Math.round(checkpoint.assetConfidence * 100)}% confidence
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this checkpoint and all its media. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

