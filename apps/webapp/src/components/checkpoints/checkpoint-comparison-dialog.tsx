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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BeforeAfterSlider } from './before-after-slider';
import { Checkpoint, VisualDiffAnalysis } from '@/lib/types';
import { Calendar, MapPin, Loader2, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { compareCheckpoints } from '@/lib/api-checkpoint';
import { getPlanLimitFailureMessage, defaultPlanLimitFailureMessage } from '@/lib/plan-limit-errors';
import { createLogger } from '@/lib/logger';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { Timestamp } from 'firebase/firestore';

const checkpointLog = createLogger('checkpoint');

function toDate(value: Checkpoint['createdAt'] | undefined): Date {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return value ? new Date(value as unknown as Date) : new Date(0);
}

interface CheckpointComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkpoint1: Checkpoint;
  checkpoint2: Checkpoint;
}

export function CheckpointComparisonDialog({
  open,
  onOpenChange,
  checkpoint1,
  checkpoint2,
}: CheckpointComparisonDialogProps) {
  const { updateCheckpoint } = useCheckpoint();
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<VisualDiffAnalysis | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Determine which is older (before) and which is newer (after)
  const date1 = toDate(checkpoint1.createdAt);
  const date2 = toDate(checkpoint2.createdAt);
  const [beforeCheckpoint, afterCheckpoint] = date1 < date2
    ? [checkpoint1, checkpoint2]
    : [checkpoint2, checkpoint1];

  useEffect(() => {
    if (!open) {
      setComparisonError(null);
      return;
    }
    const diff = afterCheckpoint.visualDiff;
    if (diff?.comparedWithCheckpointId === beforeCheckpoint.id) {
      setComparisonResult(diff);
      return;
    }
    setComparisonResult(null);
  }, [open, afterCheckpoint.id, beforeCheckpoint.id, afterCheckpoint.visualDiff]);

  const handleCompare = async () => {
    const image1 = beforeCheckpoint.media?.[0];
    const image2 = afterCheckpoint.media?.[0];

    // Validate required fields
    if (!image1?.gsURI || !image2?.gsURI) {
      checkpointLog.error('comparison.missingUrls');
      return;
    }

    if (!image1.contentType || !image2.contentType) {
      checkpointLog.error('comparison.missingContentTypes');
      return;
    }

    setIsComparing(true);
    setComparisonError(null);
    try {
      const result = (await compareCheckpoints({
        image1Url: image1.gsURI,
        image2Url: image2.gsURI,
        contentType1: image1.contentType,
        contentType2: image2.contentType,
        location: afterCheckpoint.location,
      })) as VisualDiffAnalysis & { summary?: string };

      const visualDiff: VisualDiffAnalysis = {
        id: `diff_${Date.now()}`,
        status: 'completed',
        comparedWithCheckpointId: beforeCheckpoint.id,
        summary: result.summary ?? '',
        semanticChanges: result.semanticChanges ?? [],
        regions: (result.regions ?? []).map((r: VisualDiffAnalysis['regions'][0], i: number) => ({
          id: `region_${i}`,
          bbox: r.bbox ?? { x: 0, y: 0, width: 0, height: 0 },
          changeType: r.changeType as 'added' | 'removed' | 'modified',
          severity: r.severity as 'minor' | 'moderate' | 'major' | 'critical',
          confidence: r.confidence ?? 0.5,
          description: r.description ?? '',
          changePercentage: 0,
        })),
        similarityScore: result.similarityScore ?? 0,
        matchReason: 'manual',
        completedAt: Timestamp.now(),
      };

      await updateCheckpoint(afterCheckpoint.id, { visualDiff });
      setComparisonResult(visualDiff);
    } catch (error) {
      checkpointLog.error('comparison.failed', undefined, error);
      const message = getPlanLimitFailureMessage(error);
      setComparisonError(
        message === defaultPlanLimitFailureMessage('generic')
          ? defaultPlanLimitFailureMessage('comparison')
          : message,
      );
      setComparisonResult(null);
    } finally {
      setIsComparing(false);
    }
  };

  const beforeImage = beforeCheckpoint.media[0]?.url;
  const afterImage = afterCheckpoint.media[0]?.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Compare Checkpoints</DialogTitle>
          <DialogDescription>
            Visual comparison and analysis of changes between two checkpoints
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Checkpoint Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline">Before</Badge>
                <h3 className="font-semibold">{beforeCheckpoint.name}</h3>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {format(date1 < date2 ? date1 : date2, 'PPp')}
                </div>
                {beforeCheckpoint.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    {beforeCheckpoint.location}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge>After</Badge>
                <h3 className="font-semibold">{afterCheckpoint.name}</h3>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {format(date1 > date2 ? date1 : date2, 'PPp')}
                </div>
                {afterCheckpoint.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    {afterCheckpoint.location}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comparison Views */}
          <Tabs defaultValue="slider" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="slider">Interactive Slider</TabsTrigger>
              <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
            </TabsList>

            <TabsContent value="slider" className="mt-4">
              {beforeImage && afterImage ? (
                <BeforeAfterSlider
                  beforeImage={beforeImage}
                  afterImage={afterImage}
                  beforeLabel={beforeCheckpoint.name}
                  afterLabel={afterCheckpoint.name}
                />
              ) : (
                <div className="flex items-center justify-center rounded-lg border bg-muted p-12">
                  <p className="text-muted-foreground">No images available for comparison</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="side-by-side" className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {beforeImage ? (
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                    <Image src={beforeImage} alt="Before" fill className="object-contain" />
                    <div className="absolute top-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                      Before
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg border bg-muted">
                    <p className="text-sm text-muted-foreground">No image</p>
                  </div>
                )}

                {afterImage ? (
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                    <Image src={afterImage} alt="After" fill className="object-contain" />
                    <div className="absolute top-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                      After
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg border bg-muted">
                    <p className="text-sm text-muted-foreground">No image</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* AI Comparison Results */}
          {!comparisonResult && !isComparing && (
            <div className="flex items-center justify-center rounded-lg border bg-muted p-8">
              <Button onClick={handleCompare}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Run AI Comparison
              </Button>
            </div>
          )}

          {isComparing && (
            <div className="flex items-center justify-center gap-3 rounded-lg border bg-blue-50 p-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <p className="text-blue-900">Analyzing differences...</p>
            </div>
          )}

          {comparisonError && !isComparing && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {comparisonError}
            </div>
          )}

          {comparisonResult && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold">AI Comparison Analysis</h3>

                {/* Similarity Score */}
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">
                      {Math.round(comparisonResult.similarityScore * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Similarity</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${comparisonResult.similarityScore * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Detected Changes */}
                {comparisonResult.semanticChanges && comparisonResult.semanticChanges.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Detected Changes</h4>
                    <ul className="space-y-2">
                      {comparisonResult.semanticChanges.map((change, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Regions (if available) */}
                {comparisonResult.regions && comparisonResult.regions.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Change Regions</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {comparisonResult.regions.map((region, idx) => (
                        <div key={idx} className="rounded-lg border p-3">
                          <div className="mb-1 flex items-center gap-2">
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
                          <p className="text-sm">{region.description}</p>
                          {region.confidence && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Confidence: {Math.round(region.confidence * 100)}%
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <Separator />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

