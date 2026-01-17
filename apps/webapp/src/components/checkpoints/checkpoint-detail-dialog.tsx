'use client';

import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { AnalysisResults } from './analysis-results';
import { Calendar, MapPin, Tag, Trash2, ArrowRightLeft, Loader2, AlertCircle, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useToast } from '@/hooks/use-toast';

export function CheckpointDetailDialog() {
  const { selectedCheckpoint, setSelectedCheckpoint, deleteCheckpoint, updateCheckpoint } = useCheckpoint();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset edit mode when dialog closes
  useEffect(() => {
    if (!selectedCheckpoint) {
      setIsEditing(false);
      setEditedName('');
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
  const isAnalyzing = checkpoint.analysisStatus === 'processing' || checkpoint.analysisStatus === 'pending';
  const analysisFailed = checkpoint.analysisStatus === 'failed';
  const isAnalyzed = checkpoint.analysisStatus === 'completed' && hasAnalysis;

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
      console.error('Failed to rename checkpoint:', error);
      toast({
        title: 'Rename Failed',
        description: 'Failed to rename checkpoint. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this checkpoint? This action cannot be undone.')) {
      try {
        await deleteCheckpoint(checkpoint.id);
        toast({
          title: 'Checkpoint Deleted',
          description: 'The checkpoint has been successfully deleted.',
        });
        setSelectedCheckpoint(null);
      } catch (error) {
        console.error('Failed to delete checkpoint:', error);
        toast({
          title: 'Deletion Failed',
          description: 'Failed to delete checkpoint. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleClose = () => {
    setSelectedCheckpoint(null);
  };

  return (
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
              <DialogTitle className="text-xl">{checkpoint.name}</DialogTitle>
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
                <p className="font-medium text-red-900">Analysis Failed</p>
                <p className="text-sm text-red-700">Unable to analyze this checkpoint</p>
              </div>
            </div>
          )}

          {/* AI Analysis Results */}
          {hasAnalysis && (
            <>
              <Separator />
              <AnalysisResults analysis={checkpoint.aiAnalysis} />
            </>
          )}

          {/* Visual Diff Notice */}
          {checkpoint.visualDiff && (
            <>
              <Separator />
              <div className="flex items-center gap-3 rounded-lg border bg-muted p-4">
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Comparison Available</p>
                  <p className="text-sm text-muted-foreground">
                    This checkpoint has been compared with a previous one
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  View Comparison
                </Button>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

