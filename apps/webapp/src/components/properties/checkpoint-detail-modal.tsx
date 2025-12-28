'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle, CheckCircle, Clock, Info, MapPin, Calendar, Trash2 } from 'lucide-react';
import type { Checkpoint } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useToast } from '@/hooks/use-toast';

interface CheckpointDetailModalProps {
  checkpoint: Checkpoint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckpointDetailModal({ checkpoint, open, onOpenChange }: CheckpointDetailModalProps) {
  const { deleteCheckpoint } = useCheckpoint();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (!checkpoint) return null;

  const media0 = checkpoint.media?.[0];
  const isVideo = !!media0?.contentType?.startsWith('video/');
  const mediaUrl = media0?.url;
  const date = checkpoint.createdAt?.toDate ? checkpoint.createdAt.toDate() : new Date();
  const hasIssues = (checkpoint.aiAnalysis?.issues?.length || 0) > 0;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteCheckpoint(checkpoint.id);
      toast({
        title: "Checkpoint deleted",
        description: "The checkpoint has been removed.",
      });
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      toast({
        title: "Error",
        description: "Failed to delete checkpoint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{checkpoint.name || 'Untitled Checkpoint'}</DialogTitle>
            <DialogDescription>
              {format(date, 'MMMM d, yyyy • h:mm a')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Media */}
            <div className="w-full h-96 bg-muted rounded-lg overflow-hidden relative">
              {mediaUrl ? (
                isVideo ? (
                  <video src={mediaUrl} controls className="w-full h-full object-contain" />
                ) : (
                  <Image 
                    src={mediaUrl} 
                    alt={checkpoint.name || 'Checkpoint'} 
                    fill
                    className="object-contain"
                  />
                )
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <p className="text-muted-foreground">No Media Available</p>
                </div>
              )}
            </div>

            {/* Metadata */}
            {checkpoint.location && (
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">{checkpoint.location}</p>
                </div>
              </div>
            )}

            {/* AI Analysis */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">AI Analysis</h3>

                {checkpoint.analysisStatus === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Queued for analysis</p>
                  </div>
                )}

                {checkpoint.analysisStatus === 'processing' && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-sm">Analysis in progress...</p>
                  </div>
                )}

                {checkpoint.analysisStatus === 'failed' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-6 w-6 text-destructive" />
                      <p className="font-medium text-destructive">Analysis Failed</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Unable to analyze this checkpoint. Please try again later.
                    </p>
                  </div>
                )}

                {checkpoint.analysisStatus === 'completed' && checkpoint.aiAnalysis && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {hasIssues ? (
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      )}
                      <p className="font-medium">
                        {hasIssues ? 'Issues Detected' : 'No Issues Detected'}
                      </p>
                    </div>

                    {checkpoint.aiAnalysis.summary && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {checkpoint.aiAnalysis.summary}
                      </p>
                    )}

                    {hasIssues && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Detected Issues:</p>
                        <div className="space-y-2">
                          {checkpoint.aiAnalysis.issues?.map((issue, index) => {
                            const issueText = typeof issue === 'string' ? issue : issue.description;
                            const severity = typeof issue === 'string' ? 'minor' : issue.severity || 'minor';
                            const severityColors = {
                              critical: 'bg-red-100 text-red-800 border-red-200',
                              major: 'bg-orange-100 text-orange-800 border-orange-200',
                              moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                              minor: 'bg-blue-100 text-blue-800 border-blue-200',
                            };
                            
                            return (
                              <div key={index} className="flex items-start gap-2 p-3 rounded-lg bg-muted">
                                <Badge variant="outline" className={severityColors[severity]}>
                                  {severity}
                                </Badge>
                                <p className="text-sm flex-1">{issueText}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!checkpoint.analysisStatus && (
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Not analyzed yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checkpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this checkpoint? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

