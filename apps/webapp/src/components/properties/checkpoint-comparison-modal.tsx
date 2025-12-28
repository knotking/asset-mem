'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { Checkpoint } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useToast } from '@/hooks/use-toast';
import { compareCheckpoints, type CompareCheckpointsOutput } from '@/lib/checkpoint-api';
import { Timestamp } from 'firebase/firestore';

interface CheckpointComparisonModalProps {
  checkpoint1: Checkpoint | null;
  checkpoint2: Checkpoint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckpointComparisonModal({
  checkpoint1,
  checkpoint2,
  open,
  onOpenChange,
}: CheckpointComparisonModalProps) {
  const { updateCheckpoint } = useCheckpoint();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CompareCheckpointsOutput | null>(null);

  // Sort by date (older first)
  const sortedCheckpoints = [checkpoint1, checkpoint2]
    .filter((cp): cp is Checkpoint => cp !== null)
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
      return dateA.getTime() - dateB.getTime();
    });

  const [before, after] = sortedCheckpoints;

  useEffect(() => {
    if (!open || !before || !after) {
      setAnalysis(null);
      setLoading(false);
      return;
    }

    // Check if we have cached comparison
    if (after.visualDiff?.comparedWithCheckpointId === before.id) {
      setAnalysis({
        summary: after.visualDiff.summary || after.visualDiff.semanticChanges.join('\n'),
        similarityScore: after.visualDiff.similarityScore,
        semanticChanges: after.visualDiff.semanticChanges,
        regions: after.visualDiff.regions.map((r) => ({
          description: r.description,
          changeType: r.changeType,
          severity: r.severity,
          confidence: r.confidence,
          bbox: r.bbox,
        })),
      });
      return;
    }

    // Fetch new comparison
    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const image1 = before.media?.[0];
        const image2 = after.media?.[0];

        if (!image1?.gsURI || !image2?.gsURI) {
          toast({
            title: "Error",
            description: "Missing media for comparison.",
            variant: "destructive",
          });
          return;
        }

        const result = await compareCheckpoints({
          image1Url: image1.gsURI,
          image2Url: image2.gsURI,
          contentType1: image1.contentType,
          contentType2: image2.contentType,
          location: after.location,
        });

        setAnalysis(result);

        // Save to Firestore
        await updateCheckpoint(after.id, {
          visualDiff: {
            id: `diff_${Date.now()}`,
            status: 'completed',
            comparedWithCheckpointId: before.id,
            summary: result.summary,
            semanticChanges: result.semanticChanges,
            regions: result.regions.map((r, i) => ({
              id: `region_${i}`,
              bbox: r.bbox || { x: 0, y: 0, width: 0, height: 0 },
              changeType: r.changeType,
              severity: r.severity,
              confidence: r.confidence,
              description: r.description,
              changePercentage: 0,
            })),
            similarityScore: result.similarityScore,
            completedAt: Timestamp.now(),
          },
        });
      } catch (error) {
        console.error('Comparison failed', error);
        toast({
          title: "Error",
          description: "Failed to compare checkpoints. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [open, before?.id, after?.id, updateCheckpoint, toast]);

  if (!before || !after) return null;

  const renderCheckpointPreview = (cp: Checkpoint, label: string) => {
    const imageUrl = cp.media?.[0]?.url;
    const date = cp.createdAt?.toDate ? cp.createdAt.toDate() : new Date();

    return (
      <div className="flex-1 space-y-2">
        <p className="text-center font-semibold">{label}</p>
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted border relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={cp.name || 'Checkpoint'}
              fill
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <p className="text-xs text-muted-foreground">No Image</p>
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium truncate">{cp.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{format(date, 'MMM d, yyyy')}</p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Checkpoints</DialogTitle>
          <DialogDescription>
            View the changes between two checkpoints over time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Side by Side Comparison */}
          <div className="flex gap-4">
            {renderCheckpointPreview(before, 'Before')}
            <div className="flex items-center pt-6">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
            {renderCheckpointPreview(after, 'After')}
          </div>

          {/* Analysis Section */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Comparison Analysis</h3>
              
              {loading ? (
                <div className="py-8 flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">Analyzing differences...</p>
                </div>
              ) : analysis ? (
                <div className="space-y-4">
                  <p className="text-sm">
                    {analysis.summary?.trim() ||
                      (analysis.similarityScore >= 0.98
                        ? 'No significant differences detected.'
                        : 'No comparison summary available.')}
                  </p>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Similarity Score:</p>
                    <div className="flex items-center gap-4">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${analysis.similarityScore * 100}%` }}
                        />
                      </div>
                      <p className="text-sm font-medium min-w-[4rem] text-right">
                        {Math.round(analysis.similarityScore * 100)}%
                      </p>
                    </div>
                  </div>

                  {analysis.regions && analysis.regions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Detected Changes:</p>
                      <div className="space-y-2">
                        {analysis.regions.map((region, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 rounded-lg bg-muted/50 p-3"
                          >
                            <div
                              className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                                region.changeType === 'added'
                                  ? 'bg-green-500'
                                  : region.changeType === 'removed'
                                    ? 'bg-red-500'
                                    : 'bg-yellow-500'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{region.description}</p>
                              <p className="text-xs capitalize text-muted-foreground">
                                {region.changeType} • {region.severity} severity
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Unable to generate analysis. Please try again later.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

