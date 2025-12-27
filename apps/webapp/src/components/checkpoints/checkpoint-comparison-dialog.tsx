'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Calendar, MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import type { Checkpoint } from '@homeapp/common/types';

interface CheckpointComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkpoint1: Checkpoint | null;  // Older checkpoint (Before)
  checkpoint2: Checkpoint | null;  // Newer checkpoint (After)
}

export function CheckpointComparisonDialog({
  open,
  onOpenChange,
  checkpoint1,
  checkpoint2,
}: CheckpointComparisonDialogProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  if (!checkpoint1 || !checkpoint2) return null;

  const before = checkpoint1;
  const after = checkpoint2;

  const beforeDate = before.createdAt?.toDate
    ? before.createdAt.toDate()
    : before.createdAt instanceof Date
      ? before.createdAt
      : new Date();

  const afterDate = after.createdAt?.toDate
    ? after.createdAt.toDate()
    : after.createdAt instanceof Date
      ? after.createdAt
      : new Date();

  // Get visual diff analysis if available
  const visualDiff = after.visualDiff;
  const hasDiff = visualDiff && visualDiff.status === 'completed';

  const getSimilarityColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Checkpoint Comparison</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Comparing {format(beforeDate, 'MMM dd, yyyy')} vs {format(afterDate, 'MMM dd, yyyy')}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Comparison Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Badge variant="outline">Before</Badge>
                  <h3 className="font-semibold">{before.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(beforeDate, 'MMM dd, yyyy, hh:mm a')}</span>
                  </div>
                  {before.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{before.location}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Badge variant="outline">After</Badge>
                  <h3 className="font-semibold">{after.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(afterDate, 'MMM dd, yyyy, hh:mm a')}</span>
                  </div>
                  {after.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{after.location}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Before/After Slider */}
          {before.media.length > 0 && after.media.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Visual Comparison</h3>
                  {hasDiff && (
                    <Badge
                      variant="outline"
                      className={getSimilarityColor(visualDiff.similarityScore)}
                    >
                      {Math.round(visualDiff.similarityScore * 100)}% Similar
                    </Badge>
                  )}
                </div>

                {/* Image Comparison with Slider */}
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  {/* Before Image (Full width) */}
                  <div className="absolute inset-0">
                    <Image
                      src={before.media[0].url}
                      alt="Before"
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* After Image (Clipped by slider) */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                  >
                    <Image
                      src={after.media[0].url}
                      alt="After"
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* Slider Line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-gray-400 rounded-full" />
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="absolute top-4 left-4 z-20">
                    <Badge className="bg-black/70 text-white border-none">Before</Badge>
                  </div>
                  <div className="absolute top-4 right-4 z-20">
                    <Badge className="bg-black/70 text-white border-none">After</Badge>
                  </div>
                </div>

                {/* Slider Control */}
                <div className="px-4">
                  <Slider
                    value={[sliderPosition]}
                    onValueChange={(value) => setSliderPosition(value[0])}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Comparison Analysis */}
          {hasDiff && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold">AI Analysis</h3>

                {/* Semantic Changes */}
                {visualDiff.semanticChanges && visualDiff.semanticChanges.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Detected Changes</h4>
                    <div className="space-y-2">
                      {visualDiff.semanticChanges.map((change, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border bg-muted/30 text-sm flex items-start gap-2"
                        >
                          {change.includes('improv') || change.includes('better') ? (
                            <TrendingUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          ) : change.includes('degrad') || change.includes('worse') ? (
                            <TrendingDown className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-600 shrink-0 mt-0.5" />
                          )}
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Change Regions */}
                {visualDiff.regions && visualDiff.regions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">
                      Change Regions ({visualDiff.regions.length})
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {visualDiff.regions.map((region, index) => (
                        <div
                          key={index}
                          className="p-2 rounded-lg border bg-muted/30 text-sm space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{region.description}</span>
                            <Badge
                              variant="outline"
                              className={
                                region.changeType === 'added'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : region.changeType === 'removed'
                                    ? 'bg-red-100 text-red-800 border-red-200'
                                    : 'bg-orange-100 text-orange-800 border-orange-200'
                              }
                            >
                              {region.changeType}
                            </Badge>
                          </div>
                          {region.severity && (
                            <Badge variant="outline" className="text-xs">
                              {region.severity}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Side-by-Side AI Analysis Comparison */}
          {(before.aiAnalysis || after.aiAnalysis) && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h4 className="font-semibold text-sm">Before - AI Analysis</h4>
                  {before.aiAnalysis ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {before.aiAnalysis.summary}
                      </p>
                      {before.aiAnalysis.issues && before.aiAnalysis.issues.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Issues:</p>
                          <div className="space-y-1">
                            {before.aiAnalysis.issues.slice(0, 3).map((issue, i) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                • {typeof issue === 'string' ? issue : issue.description}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No analysis available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h4 className="font-semibold text-sm">After - AI Analysis</h4>
                  {after.aiAnalysis ? (
                    <>
                      <p className="text-sm text-muted-foreground">{after.aiAnalysis.summary}</p>
                      {after.aiAnalysis.issues && after.aiAnalysis.issues.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Issues:</p>
                          <div className="space-y-1">
                            {after.aiAnalysis.issues.slice(0, 3).map((issue, i) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                • {typeof issue === 'string' ? issue : issue.description}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No analysis available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

