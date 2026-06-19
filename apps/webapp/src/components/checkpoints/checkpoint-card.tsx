'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, AlertCircle, CheckCircle, Clock, Camera, Video, Loader2 } from 'lucide-react';
import {
  deletionRetryLabel,
  resourceDeletingLabel,
  deletionErrorLabel,
} from '@/lib/deletion';
import { Button } from '@/components/ui/button';
import {
  checkpointFailureBadgeLabel,
  getCheckpointAnalysisFailureMessage,
} from '@/lib/plan-limit-errors';
import { Checkpoint } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { APP_LIST_ITEM_TITLE_CLASS } from '@/lib/app-typography';

interface CheckpointCardProps {
  checkpoint: Checkpoint;
  selected?: boolean;
  onClick?: () => void;
  onSelect?: (selected: boolean) => void;
  selectionMode?: boolean;
  isDeleting?: boolean;
  isDeleteFailed?: boolean;
  onRetryDelete?: () => void;
}

export function CheckpointCard({
  checkpoint,
  selected = false,
  onClick,
  onSelect,
  selectionMode = false,
  isDeleting = false,
  isDeleteFailed = false,
  onRetryDelete,
}: CheckpointCardProps) {
  const createdAt = checkpoint.createdAt?.toDate
    ? checkpoint.createdAt.toDate()
    : checkpoint.createdAt instanceof Date
      ? checkpoint.createdAt
      : new Date();

  const hasAnalysis = !!checkpoint.aiAnalysis;
  const isAnalyzing = checkpoint.analysisStatus === 'processing' || checkpoint.analysisStatus === 'pending';
  const analysisFailed = checkpoint.analysisStatus === 'failed';

  // Determine overall condition from analysis
  const getConditionBadge = () => {
    if (analysisFailed) {
      const label = checkpointFailureBadgeLabel(checkpoint);
      const title = getCheckpointAnalysisFailureMessage(checkpoint);
      return (
        <Badge variant="destructive" title={title}>
          {label === 'Plan limit' ? 'Plan limit' : 'Analysis failed'}
        </Badge>
      );
    }
    if (isAnalyzing) {
      return <Badge variant="outline" className="border-blue-300 text-blue-700"><Clock className="h-3 w-3 mr-1 animate-spin" />Analyzing</Badge>;
    }
    if (!hasAnalysis) {
      return <Badge variant="outline">No Analysis</Badge>;
    }

    // Severity-tier labels — keep in sync with @homeapp/common/lib/checkpoint-list-badge (mapp uses shared helper).
    const issues = checkpoint.aiAnalysis?.issues || [];
    const hasCritical = issues.some((i: any) => typeof i === 'object' && i.severity === 'critical');
    const hasMajor = issues.some((i: any) => typeof i === 'object' && i.severity === 'major');

    if (hasCritical) {
      return <Badge variant="destructive">Critical Issues</Badge>;
    }
    if (hasMajor) {
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Major Issues</Badge>;
    }
    if (issues.length > 0) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Needs Attention</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 border-green-200">Good Condition</Badge>;
  };

  const handleClick = () => {
    if (isDeleting) return;
    if (selectionMode && onSelect) {
      onSelect(!selected);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'relative min-w-0 cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary',
        selectionMode && 'hover:ring-2 hover:ring-muted-foreground',
        isDeleting && 'opacity-90'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-3 sm:gap-4">
          {/* Thumbnail */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted sm:h-24 sm:w-24">
            {checkpoint.media && checkpoint.media.length > 0 ? (
              <>
                <Image
                  src={checkpoint.media[0].thumbnailUrl || checkpoint.media[0].url}
                  alt={checkpoint.name}
                  fill
                  className="object-cover"
                />
                {checkpoint.media[0].contentType?.startsWith('video/') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Video className="h-6 w-6 text-white" />
                  </div>
                )}
                {checkpoint.media.length > 1 && (
                  <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                    <Camera className="inline h-3 w-3 mr-0.5" />
                    {checkpoint.media.length}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            {selectionMode && (
              <div className="absolute top-1 left-1">
                {selected ? (
                  <CheckCircle className="h-5 w-5 text-primary fill-primary" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-white bg-black/20" />
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <div className="sm:flex sm:items-start sm:justify-between sm:gap-2">
                <h3
                  className={cn(
                    APP_LIST_ITEM_TITLE_CLASS,
                    'min-w-0 break-words text-balance sm:flex-1 sm:line-clamp-2 lg:line-clamp-1',
                  )}
                  title={checkpoint.name || undefined}
                >
                  {checkpoint.name || (isAnalyzing ? 'Analyzing...' : 'Untitled Checkpoint')}
                </h3>
                <div className="mt-1.5 shrink-0 sm:mt-0">{getConditionBadge()}</div>
              </div>
              {checkpoint.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{checkpoint.description}</p>
              )}
              {isDeleteFailed ? (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-destructive">{deletionErrorLabel(checkpoint.deletionError)}</p>
                  {onRetryDelete ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryDelete();
                      }}
                    >
                      {deletionRetryLabel}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <div className="flex shrink-0 items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{format(createdAt, 'MMM dd, yyyy')}</span>
                </div>
                {checkpoint.location && (
                  <div className="flex min-w-0 items-start gap-1">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="min-w-0 break-words">{checkpoint.location}</span>
                  </div>
                )}
              </div>

              {checkpoint.visualDiff && (
                <Badge variant="outline" className="w-fit shrink-0 text-xs">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Comparison Available
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      {isDeleting ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {resourceDeletingLabel}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

